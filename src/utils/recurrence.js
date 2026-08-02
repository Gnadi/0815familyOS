// Lightweight recurrence helper. A `recurrence` is one of:
//   null
//   { freq: 'daily'|'weekly'|'monthly'|'yearly', interval: 1, until?: 'YYYY-MM-DD' }
//
// We store the master event/task with its original `date`/`dueDate`. Views
// expand it virtually with `expandRecurringEvent(master, from, to)`.

export const FREQS = ['daily', 'weekly', 'monthly', 'yearly'];

export function isValidRecurrence(rec) {
  if (!rec) return false;
  return FREQS.includes(rec.freq) && Number(rec.interval) > 0;
}

// Pass the i18n helpers ({ t, tn }) to localize; without them it falls back to
// English so the function stays usable outside React.
export function describeRecurrence(rec, t, tn) {
  if (!isValidRecurrence(rec)) return null;
  const n = Number(rec.interval) || 1;
  if (t && tn) {
    const unit = tn(`recurrence.${rec.freq}`, n);
    return n === 1
      ? t('recurrence.everyOne', { unit })
      : t('recurrence.everyN', { n, unit });
  }
  const unit = {
    daily: n === 1 ? 'day' : 'days',
    weekly: n === 1 ? 'week' : 'weeks',
    monthly: n === 1 ? 'month' : 'months',
    yearly: n === 1 ? 'year' : 'years',
  }[rec.freq];
  return n === 1 ? `Every ${unit}` : `Every ${n} ${unit}`;
}

function addInterval(date, freq, interval) {
  const next = new Date(date);
  switch (freq) {
    case 'daily':
      next.setDate(next.getDate() + interval);
      break;
    case 'weekly':
      next.setDate(next.getDate() + interval * 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + interval);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + interval);
      break;
    default:
      return null;
  }
  return next;
}

function untilDate(rec) {
  if (!rec.until) return null;
  const [y, m, d] = String(rec.until).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59);
}

// Calendar-day number for a date, independent of DST. Used to measure the gap
// between two dates in whole days without tripping over 23/25-hour days.
function dayNumber(d) {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

// Hard caps: how many steps we're willing to walk, and how many occurrences a
// single master may contribute to one window. Both only guard against bad data.
const MAX_STEPS = 1000;
const MAX_OCCURRENCES = 500;

// Expand a single master event into virtual occurrences within [from, to].
// Returns an array of "shadow" events that share the master's id but have
// `masterId` and `isRecurringInstance` set, plus a unique virtual id.
export function expandRecurringEvent(master, from, to) {
  const rec = master.recurrence;
  if (!isValidRecurrence(rec)) return [master];

  const interval = Math.max(1, Number(rec.interval) || 1);
  const stop = untilDate(rec);
  const out = [];
  const start = master.date instanceof Date ? new Date(master.date) : new Date(master.date);
  if (Number.isNaN(start.getTime())) return [];

  // `index` is the occurrence number counted from the master, so the virtual
  // ids stay identical no matter which window we happen to be expanding.
  let index = 0;
  let cursor = new Date(start);

  // Daily and weekly steps are a fixed number of calendar days, so we can jump
  // straight to the occurrence just before the window instead of walking there
  // one step at a time. Without this a long-running series (say a daily chore
  // started two years ago) would exhaust the step budget before reaching
  // `from` and silently disappear from the calendar, dashboard and .ics export.
  const stepDays = rec.freq === 'daily' ? interval : rec.freq === 'weekly' ? interval * 7 : 0;
  if (stepDays > 0 && cursor < from) {
    const skip = Math.floor((dayNumber(from) - dayNumber(cursor)) / stepDays);
    if (skip > 0) {
      index = skip;
      // setDate() keeps the local time-of-day across DST boundaries.
      cursor.setDate(cursor.getDate() + skip * stepDays);
    }
  }

  for (let step = 0; step < MAX_STEPS && out.length < MAX_OCCURRENCES; step += 1) {
    if (stop && cursor > stop) break;
    if (cursor > to) break;
    if (cursor >= from) {
      out.push({
        ...master,
        date: new Date(cursor),
        // Keep the master id stable for editing; but flag virtual instances.
        id: index === 0 ? master.id : `${master.id}__r${index}`,
        masterId: master.id,
        isRecurringInstance: index > 0,
      });
    }
    const next = addInterval(cursor, rec.freq, interval);
    if (!next || next.getTime() === cursor.getTime()) break;
    cursor = next;
    index += 1;
  }
  return out;
}

export function expandEventsInRange(events, from, to) {
  const out = [];
  for (const ev of events) {
    if (!ev.date) continue;
    if (isValidRecurrence(ev.recurrence)) {
      out.push(...expandRecurringEvent(ev, from, to));
    } else if (ev.date >= from && ev.date <= to) {
      out.push(ev);
    }
  }
  return out;
}

// For a recurring task that just got completed, return the next dueDate
// (or null if the recurrence has expired).
export function nextOccurrenceAfter(currentDate, rec) {
  if (!isValidRecurrence(rec) || !currentDate) return null;
  const interval = Math.max(1, Number(rec.interval) || 1);
  const stop = untilDate(rec);
  const next = addInterval(currentDate, rec.freq, interval);
  if (!next) return null;
  if (stop && next > stop) return null;
  return next;
}
