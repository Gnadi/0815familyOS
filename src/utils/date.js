import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
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

export function upcomingEvents(events, from = new Date(), max = 3) {
  return events.filter((e) => e.date >= from).slice(0, max);
}

export function formatRelativeDay(d) {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  if (isSameDay(d, today)) return 'Today';
  if (isSameDay(d, tomorrow)) return 'Tomorrow';
  return format(d, 'EEE');
}

export { addMonths, subMonths, format, isSameDay, isSameMonth };
