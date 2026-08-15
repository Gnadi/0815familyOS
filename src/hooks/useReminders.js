import { useMemo } from 'react';
import { isSameDay } from 'date-fns';
import useAuth from './useAuth';
import useEvents from './useEvents';
import useTasks from './useTasks';
import useVaccinations from './useVaccinations';
import { expandEventsInRange } from '../utils/recurrence';
import { eventsOnDay } from '../utils/date';
import { upcomingBirthdays } from '../utils/birthdays';

/**
 * One ranked list of everything that wants attention.
 *
 * The dashboard already worked all of this out — HealthAlerts computes a rolling
 * 30-day vaccination window, UpcomingBirthdays a 60-day one, DailyPreview today's
 * events and due tasks — and then kept it to itself. Nothing aggregated it, and
 * nothing carried it to anyone not currently looking at the dashboard.
 *
 * This consumes the same hooks and the same helpers rather than re-deriving any
 * of it. That matters: a fourth independent idea of "due soon" is how three
 * widgets came to disagree in the first place.
 *
 * Deliberately not push. Real push needs a Cloud Function to send it, which needs
 * the Blaze plan, and the only trigger available here is a client that is already
 * open — at which point push was unnecessary. Promising it in the UI would repeat
 * exactly the mistake the calendar copy just had corrected.
 */

// Vaccinations already overdue or due within a month. Matches HealthAlerts.
const VACCINATION_HORIZON_DAYS = 30;
// Birthdays close enough to still buy a present for.
const BIRTHDAY_HORIZON_DAYS = 14;

// Lower sorts first. Something overdue outranks something merely upcoming.
const KIND_WEIGHT = { vaccination: 0, event: 1, task: 2, birthday: 3 };

/** A stable id per reminder, so "seen" survives a reload and a re-render. */
function reminderId(kind, key, when) {
  const day = when ? new Date(when).toISOString().slice(0, 10) : 'none';
  return `${kind}:${key}:${day}`;
}

export default function useReminders() {
  const { userDoc, family } = useAuth();
  const familyId = userDoc?.familyId;
  const { vaccinations } = useVaccinations(familyId);
  const { events } = useEvents(familyId);
  const { tasks } = useTasks(familyId);

  return useMemo(() => {
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const horizon = new Date();
    horizon.setDate(horizon.getDate() + VACCINATION_HORIZON_DAYS);
    horizon.setHours(23, 59, 59, 999);

    const items = [];

    // Vaccinations — the same rolling window HealthAlerts uses, including ones
    // already overdue, which are exactly what needs chasing.
    for (const v of vaccinations) {
      if (v.status === 'done' || !v.date || v.date > horizon) continue;
      const kid = (family?.kids || []).find((k) => k.id === v.kidId);
      items.push({
        id: reminderId('vaccination', v.id, v.date),
        kind: 'vaccination',
        date: v.date,
        overdue: v.date < dayStart,
        title: v.name,
        personName: kid?.name || null,
        to: '/health',
      });
    }

    // Today's events, recurrences expanded — the same path DailyPreview takes.
    const todayEvents = eventsOnDay(expandEventsInRange(events, dayStart, dayEnd), today);
    for (const ev of todayEvents) {
      items.push({
        id: reminderId('event', ev.id ?? ev.title, ev.date),
        kind: 'event',
        date: ev.date,
        overdue: false,
        title: ev.title,
        personName: null,
        to: '/calendar',
      });
    }

    // Tasks due today and not finished.
    for (const task of tasks) {
      if (!task.dueDate || task.status === 'completed') continue;
      if (!isSameDay(task.dueDate, today)) continue;
      items.push({
        id: reminderId('task', task.id, task.dueDate),
        kind: 'task',
        date: task.dueDate,
        overdue: false,
        title: task.title,
        personName: null,
        to: '/tasks',
      });
    }

    // Birthdays — a tighter window than the dashboard's 60 days, which is a
    // browsing list rather than a nudge.
    for (const { person, info } of upcomingBirthdays(family, {
      withinDays: BIRTHDAY_HORIZON_DAYS,
      today,
    })) {
      items.push({
        id: reminderId('birthday', person.id ?? person.name, info.next),
        kind: 'birthday',
        date: info.next,
        overdue: false,
        title: person.name,
        turning: info.turning,
        daysUntil: info.daysUntil,
        personName: null,
        to: '/gifts',
      });
    }

    items.sort((a, b) => {
      // Overdue first, then soonest, then by kind so the order is stable.
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const byDate = new Date(a.date) - new Date(b.date);
      if (byDate !== 0) return byDate;
      return KIND_WEIGHT[a.kind] - KIND_WEIGHT[b.kind];
    });

    return items;
  }, [vaccinations, events, tasks, family]);
}
