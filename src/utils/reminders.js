// What the app should remind a family member of, and when.
//
// Everything here is pure: it takes the data the app already streams (events,
// tasks, trackers, vaccinations) and returns a flat list of reminders, each
// with the moment it becomes due and the moment it stops being worth sending.
// Delivery lives elsewhere (src/components/notifications/ReminderScheduler),
// so a later server-side sender can reuse exactly the same rules.
//
// A reminder:
//   { id, kind, fireAt: Date, expiresAt: Date, url, ...details }
//
// `id` is stable for as long as the underlying fact is the same, and changes
// when it is not: moving an event, logging a new dose or rolling a recurring
// task forward all produce a new id, so the reminder is sent again.

// Explicit extensions: scripts/send-reminders.mjs imports this file straight
// from Node, which (unlike Vite) does not resolve extensionless paths.
import { expandEventsInRange } from './recurrence.js';
import { trackerStatus } from './tracker.js';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

// When day-level reminders (all-day events, tasks, vaccinations) go out.
export const MORNING_HOUR = 8;
// When a daily tracker goal that is still open gets a nudge.
export const EVENING_HOUR = 18;
// How long after the next dose becomes possible the reminder is still sent.
// Past that, whoever opens the app sees it on the tracker card anyway.
const TRACKER_GRACE_MS = 2 * HOUR_MS;

export const EVENT_SCOPES = ['mine', 'all', 'off'];
export const EVENT_LEAD_MINUTES = [10, 30, 60, 120];

export const DEFAULT_NOTIFICATION_PREFS = {
  events: 'mine',
  eventLeadMinutes: 30,
  trackers: true,
  tasks: true,
  vaccinations: true,
};

// The stored preferences come from a user document anyone could have written
// by hand, so every field falls back to its default rather than trusting it.
export function normalizeNotificationPrefs(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const bool = (v, d) => (typeof v === 'boolean' ? v : d);
  return {
    events: EVENT_SCOPES.includes(p.events) ? p.events : DEFAULT_NOTIFICATION_PREFS.events,
    eventLeadMinutes: EVENT_LEAD_MINUTES.includes(p.eventLeadMinutes)
      ? p.eventLeadMinutes
      : DEFAULT_NOTIFICATION_PREFS.eventLeadMinutes,
    trackers: bool(p.trackers, DEFAULT_NOTIFICATION_PREFS.trackers),
    tasks: bool(p.tasks, DEFAULT_NOTIFICATION_PREFS.tasks),
    vaccinations: bool(p.vaccinations, DEFAULT_NOTIFICATION_PREFS.vaccinations),
  };
}

function atHour(day, hour) {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function endOfDay(day) {
  const d = new Date(day);
  d.setHours(23, 59, 59, 999);
  return d;
}

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// An event at exactly midnight is how an all-day event arrives (an .ics DATE
// value) and the only way to enter one by hand. "Starts in 30 minutes" at
// 23:30 the night before would be useless, so these get a morning reminder.
function isAllDay(date) {
  return date.getHours() === 0 && date.getMinutes() === 0;
}

// "Mine" means: I am the responsible parent, or nobody is. An unassigned event
// is everybody's, and the reminder is the nudge to pick it up.
function isMine(responsible, me) {
  return !responsible || responsible === me?.displayName;
}

function eventReminders(events, me, prefs, from, to) {
  if (prefs.events === 'off') return [];
  const leadMs = prefs.eventLeadMinutes * MINUTE_MS;
  // Widen the expansion window by the lead time, so an event starting just
  // past `to` still produces the reminder that falls inside it.
  const occurrences = expandEventsInRange(events, from, new Date(to.getTime() + leadMs));
  const out = [];
  for (const ev of occurrences) {
    if (!(ev.date instanceof Date) || Number.isNaN(ev.date.getTime())) continue;
    if (prefs.events === 'mine' && !isMine(ev.responsibleParent, me)) continue;
    const allDay = isAllDay(ev.date);
    out.push({
      id: `event:${ev.id}:${ev.date.getTime()}`,
      kind: 'event',
      fireAt: allDay ? atHour(ev.date, MORNING_HOUR) : new Date(ev.date.getTime() - leadMs),
      expiresAt: allDay ? endOfDay(ev.date) : ev.date,
      url: '/calendar',
      title: ev.title || '',
      at: ev.date,
      allDay,
      location: ev.location || '',
    });
  }
  return out;
}

function taskReminders(tasks, me) {
  const out = [];
  for (const task of tasks) {
    if (task.status === 'completed' || !(task.dueDate instanceof Date)) continue;
    const assignees = task.assigneeIds || [];
    if (assignees.length > 0 && !assignees.includes(me?.uid)) continue;
    out.push({
      id: `task:${task.id}:${dayKey(task.dueDate)}`,
      kind: 'task',
      fireAt: atHour(task.dueDate, MORNING_HOUR),
      expiresAt: endOfDay(task.dueDate),
      url: '/tasks',
      title: task.title || '',
    });
  }
  return out;
}

function vaccinationReminders(vaccinations, kidName) {
  const out = [];
  for (const v of vaccinations) {
    if (v.status === 'done' || !(v.date instanceof Date)) continue;
    out.push({
      id: `vaccination:${v.id}:${dayKey(v.date)}`,
      kind: 'vaccination',
      fireAt: atHour(v.date, MORNING_HOUR),
      expiresAt: endOfDay(v.date),
      url: '/health',
      title: v.name || '',
      kidName: kidName(v.kidId),
    });
  }
  return out;
}

function trackerReminders(trackers, entries, kids, now) {
  const out = [];
  for (const kid of kids) {
    for (const tracker of trackers) {
      if (!tracker.kidIds?.includes(kid.id)) continue;
      const status = trackerStatus(tracker, entries, kid.id, now);
      const base = { url: '/tracker', title: tracker.name || '', emoji: tracker.emoji || '', kidName: kid.name || '' };

      // The next dose is possible again. Keyed on the last entry, so each new
      // dose arms exactly one reminder.
      if (status.cooldownUntil && status.last) {
        out.push({
          ...base,
          id: `tracker-dose:${tracker.id}:${kid.id}:${status.last.id}`,
          kind: 'trackerDose',
          fireAt: status.cooldownUntil,
          expiresAt: new Date(status.cooldownUntil.getTime() + TRACKER_GRACE_MS),
        });
      }

      // A daily goal still open in the evening. Recomputed from live data, so
      // it disappears the moment the last one of the day is logged.
      if (status.hasGoal && !status.goalMet) {
        out.push({
          ...base,
          id: `tracker-goal:${tracker.id}:${kid.id}:${dayKey(now)}`,
          kind: 'trackerGoal',
          fireAt: atHour(now, EVENING_HOUR),
          expiresAt: endOfDay(now),
          remaining: status.goal - status.todayCount,
        });
      }
    }
  }
  return out;
}

// All reminders that are still worth sending and come due before `now +
// horizonMs`, earliest first. Ones already due (fireAt <= now) are included:
// opening the app at 10:00 should still bring up a task due today.
export function collectReminders({
  events = [],
  tasks = [],
  trackers = [],
  trackerEntries = [],
  vaccinations = [],
  kids = [],
  me,
  prefs: rawPrefs,
  now = new Date(),
  horizonMs = 24 * HOUR_MS,
}) {
  const prefs = normalizeNotificationPrefs(rawPrefs);
  const to = new Date(now.getTime() + horizonMs);
  const kidName = (id) => kids.find((k) => k.id === id)?.name || '';

  const all = [
    // From the start of today, not from `now`: an all-day event began at
    // midnight and is still today's news.
    ...eventReminders(events, me, prefs, atHour(now, 0), to),
    ...(prefs.tasks ? taskReminders(tasks, me) : []),
    ...(prefs.vaccinations ? vaccinationReminders(vaccinations, kidName) : []),
    ...(prefs.trackers ? trackerReminders(trackers, trackerEntries, kids, now) : []),
  ];

  return all
    .filter((r) => r.expiresAt > now && r.fireAt <= to && r.fireAt < r.expiresAt)
    .sort((a, b) => a.fireAt - b.fireAt);
}

// Reminders to send right now: due, not expired, and not sent before.
export function dueReminders(reminders, sentIds, now = new Date()) {
  return reminders.filter((r) => r.fireAt <= now && r.expiresAt > now && !sentIds.has(r.id));
}

// The next moment something becomes due, or null when nothing is pending.
export function nextFireAt(reminders, now = new Date()) {
  const next = reminders.find((r) => r.fireAt > now);
  return next ? next.fireAt : null;
}

// Title and body of a notification. `t` is the i18n helper; `formatTime`
// turns a Date into a short local time ("14:30").
export function reminderText(reminder, t, formatTime) {
  switch (reminder.kind) {
    case 'event':
      return {
        title: reminder.title,
        body: reminder.allDay
          ? t('notifications.eventToday')
          : reminder.location
            ? t('notifications.eventAtWhere', { time: formatTime(reminder.at), location: reminder.location })
            : t('notifications.eventAt', { time: formatTime(reminder.at) }),
      };
    case 'task':
      return { title: reminder.title, body: t('notifications.taskDue') };
    case 'vaccination':
      return {
        title: t('notifications.vaccinationTitle', { name: reminder.kidName }),
        body: t('notifications.vaccinationDue', { vaccine: reminder.title }),
      };
    case 'trackerDose':
      return {
        title: `${reminder.emoji} ${reminder.title}`.trim(),
        body: t('notifications.trackerDose', { name: reminder.kidName }),
      };
    case 'trackerGoal':
      return {
        title: `${reminder.emoji} ${reminder.title}`.trim(),
        body: t('notifications.trackerGoal', { name: reminder.kidName, count: reminder.remaining }),
      };
    default:
      return { title: reminder.title || '', body: '' };
  }
}

// More reminders due at once than this (the first check after a night
// offline, say) go out as one summary instead of a burst.
export const MAX_SEPARATE_NOTIFICATIONS = 3;

// The notifications to show for a set of due reminders: one each, or a single
// summary when there are too many. Each carries the moment it stops being
// worth showing, which the push sender turns into the message's TTL.
export function notificationBatch(due, t, formatTime) {
  const items = due.map((r) => ({
    ...reminderText(r, t, formatTime),
    tag: r.id,
    url: r.url,
    expiresAt: r.expiresAt,
  }));
  if (items.length <= MAX_SEPARATE_NOTIFICATIONS) return items;
  return [{
    title: t('notifications.summaryTitle', { count: items.length }),
    body: items.map((x) => x.title).join(' · '),
    tag: 'summary',
    url: '/dashboard',
    expiresAt: new Date(Math.max(...items.map((x) => x.expiresAt.getTime()))),
  }];
}
