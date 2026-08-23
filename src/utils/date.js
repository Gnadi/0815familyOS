import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';

// Monday-start weeks (matches the mock's "M T W T F S S" header).
const WEEK_OPTS = { weekStartsOn: 1 };

export function getWeekDays(anchor) {
  const start = startOfWeek(anchor, WEEK_OPTS);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function getMonthGrid(anchor) {
  const gridStart = startOfWeek(startOfMonth(anchor), WEEK_OPTS);
  const gridEnd = endOfWeek(endOfMonth(anchor), WEEK_OPTS);
  const days = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

// Local calendar-day identity of a date, cheap enough to call per event.
export function dayKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Bucket events by calendar day, sorted by time within each day.
//
// The month grid asked `events.filter(isSameDay)` once per cell: 42 full passes
// over an expanded event list that can hold tens of thousands of recurring
// occurrences, on every single render. One pass builds the whole lookup.
export function groupEventsByDay(events) {
  const byDay = new Map();
  for (const ev of events || []) {
    const key = dayKey(ev?.date);
    if (!key) continue;
    const bucket = byDay.get(key);
    if (bucket) bucket.push(ev);
    else byDay.set(key, [ev]);
  }
  for (const bucket of byDay.values()) {
    bucket.sort((a, b) => a.date - b.date);
  }
  return byDay;
}

// Shared empty result so a day with no events keeps a stable array identity.
export const NO_EVENTS = Object.freeze([]);

export function upcomingEvents(events, from = startOfDay(new Date()), max = 3) {
  return events.filter((e) => e.date >= from).slice(0, max);
}

// Pass a `t` translation function to localize "Today"/"Tomorrow"; without one
// it falls back to English. The weekday name (format 'EEE') is localized
// globally via date-fns' default locale.
export function formatRelativeDay(d, t) {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  if (isSameDay(d, today)) return t ? t('common.today') : 'Today';
  if (isSameDay(d, tomorrow)) return t ? t('common.tomorrow') : 'Tomorrow';
  return format(d, 'EEE');
}

export { addMonths, subMonths, format, isSameDay, isSameMonth };
