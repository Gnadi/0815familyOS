import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  getDefaultOptions,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { eventDays, isAllDay } from './eventTime';

// Monday-start weeks (matches the mock's "M T W T F S S" header).
const WEEK_OPTS = { weekStartsOn: 1 };

// The Monday of the week `date` falls in.
export function weekStart(date) {
  return startOfWeek(date, WEEK_OPTS);
}

export function getWeekDays(anchor) {
  const start = weekStart(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// Heading for a week: "October 2026", or "Sep – Oct 2026" when the week spans
// two months, or "Dec 2026 – Jan 2027" across a year boundary. 'LLL' is the
// stand-alone short month, which German writes without the trailing dot
// ("Sep – Okt 2026").
export function formatWeekRange(days) {
  const first = days[0];
  const last = days[days.length - 1];
  if (isSameMonth(first, last)) return format(first, 'LLLL yyyy');
  if (first.getFullYear() === last.getFullYear()) {
    return `${format(first, 'LLL')} – ${format(last, 'LLL yyyy')}`;
  }
  return `${format(first, 'LLL yyyy')} – ${format(last, 'LLL yyyy')}`;
}

// Date patterns whose word order differs by language: English puts the month
// before the day ("Oct 2"), German the day first with a dot ("2. Okt.").
// date-fns' global locale (set in I18nContext) translates the names; this
// picks the order to match.
const DATE_PATTERNS = {
  short:           { en: 'MMM d',            de: 'd. MMM' },
  long:            { en: 'MMMM d',           de: 'd. MMMM' },
  weekdayShort:    { en: 'EEE, MMM d',       de: 'EEE, d. MMM' },
  withYear:        { en: 'MMM d, yyyy',      de: 'd. MMM yyyy' },
  dayMonthYear:    { en: 'dd MMM yyyy',      de: 'dd. MMM yyyy' },
  weekdayWithYear: { en: 'EEEE, d MMM yyyy', de: 'EEEE, d. MMM yyyy' },
  weekdayTime:     { en: 'EEE d MMM, HH:mm', de: 'EEE, d. MMM, HH:mm' },
};

// `style` is a key of DATE_PATTERNS.
export function formatDate(date, style) {
  const lang = getDefaultOptions().locale?.code?.startsWith('de') ? 'de' : 'en';
  return format(date, DATE_PATTERNS[style][lang]);
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
  const add = (key, ev) => {
    const bucket = byDay.get(key);
    if (bucket) bucket.push(ev);
    else byDay.set(key, [ev]);
  };
  for (const ev of events || []) {
    const key = dayKey(ev?.date);
    if (!key) continue;
    // A holiday from Monday to Friday, or a night shift into the morning,
    // belongs to every day it covers -- not only the one it starts on.
    const span = eventDays(ev);
    if (!span || span.first.getTime() === span.last.getTime()) {
      add(key, ev);
      continue;
    }
    for (let d = new Date(span.first); d <= span.last; d.setDate(d.getDate() + 1)) {
      add(dayKey(d), ev);
    }
  }
  for (const bucket of byDay.values()) {
    bucket.sort(compareEventsInDay);
  }
  return byDay;
}

// All-day events head the day; the rest follow in start order.
export function compareEventsInDay(a, b) {
  const allDayA = isAllDay(a);
  const allDayB = isAllDay(b);
  if (allDayA !== allDayB) return allDayA ? -1 : 1;
  return a.date - b.date;
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
