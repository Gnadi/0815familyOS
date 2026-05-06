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

export function describeRecurrence(rec) {
  if (!isValidRecurrence(rec)) return null;
  const n = Number(rec.interval) || 1;
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

// Expand a single master event into virtual occurrences within [from, to].
// Returns an array of "shadow" events that share the master's id but have
// `occurrenceDate` and `isRecurringInstance` set, plus a unique virtual id.
export function expandRecurringEvent(master, from, to) {
  const rec = master.recurrence;
  if (!isValidRecurrence(rec)) return [master];

  const interval = Math.max(1, Number(rec.interval) || 1);
  const stop = untilDate(rec);
  const out = [];
  let cursor = master.date instanceof Date ? new Date(master.date) : new Date(master.date);

  // Walk forward up to a hard cap to avoid runaway loops on bad data.
  for (let i = 0; i < 500; i += 1) {
    if (stop && cursor > stop) break;
    if (cursor > to) break;
    if (cursor >= from) {
      out.push({
        ...master,
        date: new Date(cursor),
        // Keep the master id stable for editing; but flag virtual instances.
        id: i === 0 ? master.id : `${master.id}__r${i}`,
        masterId: master.id,
        isRecurringInstance: i > 0,
      });
    }
    const next = addInterval(cursor, rec.freq, interval);
    if (!next || next.getTime() === cursor.getTime()) break;
    cursor = next;
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
