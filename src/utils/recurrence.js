// Lightweight recurrence helper. A `recurrence` is one of:
//   null
//   { freq: 'daily'|'weekly'|'monthly'|'yearly', interval: 1, until?: 'YYYY-MM-DD',
//     byDay?: ['MO','WE','FR'], count?: 6, exdates?: ['20260915T160000'] }
//
// The three optional fields come from subscribed and imported calendars, where
// they decide what the series actually is: Google writes "Mon, Wed and Fri" as
// one weekly rule with BYDAY, ends a course after six sessions with COUNT, and
// records a cancelled single occurrence as an EXDATE. Ignoring them meant two
// thirds of a BYDAY series never appeared, a COUNT series ran forever, and
// cancelled occurrences kept showing up. The event form never sets them; only
// the .ics parser does.
//
// We store the master event/task with its original `date`/`dueDate`. Views
// expand it virtually with `expandRecurringEvent(master, from, to)`.

export const FREQS = ['daily', 'weekly', 'monthly', 'yearly'];

export function isValidRecurrence(rec) {
  if (!rec) return false;
  return FREQS.includes(rec.freq) && Number(rec.interval) > 0;
}

// ICS weekday codes, indexed the way Date#getDay() counts.
export const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// Wall-clock identity of one occurrence, in the local YYYYMMDDTHHMMSS form an
// ICS EXDATE carries. Compared as text, so an hour lost to DST cannot turn
// "16:00 every Tuesday" into a near-miss that fails to cancel.
export function occurrenceKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`
    + `T${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
  );
}

// Weekdays of a weekly BYDAY rule, as Date#getDay() numbers, ascending.
function byDayNumbers(rec) {
  if (rec.freq !== 'weekly' || !Array.isArray(rec.byDay) || !rec.byDay.length) return null;
  const days = [...new Set(
    rec.byDay
      .map((code) => DAY_CODES.indexOf(String(code).toUpperCase()))
      .filter((n) => n >= 0),
  )].sort((a, b) => a - b);
  return days.length ? days : null;
}

function excludedKeys(rec) {
  return Array.isArray(rec.exdates) && rec.exdates.length ? new Set(rec.exdates) : null;
}

function occurrenceLimit(rec) {
  const n = Number(rec.count);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
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

function occurrenceOf(master, date, index) {
  const start = new Date(date);
  const masterStart = master.date instanceof Date ? master.date : new Date(master.date);
  const masterEnd = master.endDate instanceof Date ? master.endDate : null;
  // A series has one duration, so every occurrence ends that far after its own
  // start. Carrying the master's end over unchanged would have shown next
  // month's appointment ending on the day the series began.
  const endDate = masterEnd && masterEnd > masterStart
    ? new Date(start.getTime() + (masterEnd.getTime() - masterStart.getTime()))
    : null;
  return {
    ...master,
    date: start,
    endDate,
    // Keep the master id stable for editing; but flag virtual instances.
    id: index === 0 ? master.id : `${master.id}__r${index}`,
    masterId: master.id,
    isRecurringInstance: index > 0,
  };
}

// The date of `dayNum` (Date#getDay() numbering) in the Monday-started week of
// `weekStart`, at the series' time of day.
function dayInWeek(weekStart, dayNum, start) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + ((dayNum + 6) % 7));
  d.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
  return d;
}

// Weekly rules that name their weekdays (BYDAY:MO,WE,FR). One step is a week
// and every named weekday in it is an occurrence -- which is why walking the
// rule one interval at a time, as the plain path below does, only ever produced
// the master's own weekday and dropped the rest of the series.
function expandWeeklyByDay(master, rec, from, to, days) {
  const interval = Math.max(1, Number(rec.interval) || 1);
  const stop = untilDate(rec);
  const limit = occurrenceLimit(rec);
  const excluded = excludedKeys(rec);
  const start = new Date(master.date);
  const out = [];

  // Monday of the master's own week; every later week is a multiple of the
  // interval from here.
  const weekStart = new Date(start);
  weekStart.setDate(weekStart.getDate() - ((start.getDay() + 6) % 7));

  // Jump to the week before the window rather than walking there one week at a
  // time, for the same reason the plain path does: a series started years ago
  // would otherwise run out of steps before reaching `from` and disappear.
  let index = 0;
  let firstWeek = 0;
  if (weekStart < from) {
    const weeks = Math.floor((dayNumber(from) - dayNumber(weekStart)) / (7 * interval));
    if (weeks > 0) {
      // The master's own week starts mid-rule and may contribute fewer days.
      const firstWeekDays = days.filter((d) => dayInWeek(weekStart, d, start) >= start).length;
      index = firstWeekDays + (weeks - 1) * days.length;
      firstWeek = weeks;
    }
  }

  for (let week = firstWeek; week < firstWeek + MAX_STEPS; week += 1) {
    if (out.length >= MAX_OCCURRENCES) break;
    const base = new Date(weekStart);
    base.setDate(base.getDate() + week * interval * 7);
    // Every day of this week lies on or after its Monday, so once that is past
    // the window (or the rule's end) nothing later can qualify.
    if (base > to) break;
    if (stop && base > stop) break;

    for (const dayNum of days) {
      const d = dayInWeek(base, dayNum, start);
      // Days named by the rule but lying before the series started are not
      // occurrences, and they must not consume an occurrence number either.
      if (d < start) continue;
      if (stop && d > stop) return out;
      if (limit && index >= limit) return out;
      const n = index;
      index += 1;
      // An excluded occurrence still counts towards COUNT and still consumes
      // its number, so the ids of the ones around it do not shift.
      if (excluded && excluded.has(occurrenceKey(d))) continue;
      if (d > to) return out;
      if (d >= from) out.push(occurrenceOf(master, d, n));
    }
  }
  return out;
}

// Expand a single master event into virtual occurrences within [from, to].
// Returns an array of "shadow" events that share the master's id but have
// `masterId` and `isRecurringInstance` set, plus a unique virtual id.
export function expandRecurringEvent(master, from, to) {
  const rec = master.recurrence;
  if (!isValidRecurrence(rec)) return [master];

  const interval = Math.max(1, Number(rec.interval) || 1);
  const stop = untilDate(rec);
  const limit = occurrenceLimit(rec);
  const excluded = excludedKeys(rec);
  const out = [];
  const start = master.date instanceof Date ? new Date(master.date) : new Date(master.date);
  if (Number.isNaN(start.getTime())) return [];

  const days = byDayNumbers(rec);
  if (days) return expandWeeklyByDay(master, rec, from, to, days);

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
    if (limit && index >= limit) break;
    if (stop && cursor > stop) break;
    if (cursor > to) break;
    // An excluded occurrence keeps its number: the ids of the occurrences
    // around it must not shift because one was cancelled upstream.
    if (cursor >= from && !(excluded && excluded.has(occurrenceKey(cursor)))) {
      out.push(occurrenceOf(master, cursor, index));
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
