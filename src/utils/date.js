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

export function eventsOnDay(events, day) {
  return events.filter((e) => isSameDay(e.date, day));
}

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
