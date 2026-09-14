// The end of an event, and how it is written next to the start.
//
// Only events that come from a calendar have one: an .ics VEVENT carries DTEND
// (or DURATION), the event form does not offer an end time yet. Everything that
// renders a time therefore has to cope with both shapes, which is what these
// two helpers are for.

import { format } from 'date-fns';

function asDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Calendar days between two dates, DST-proof: an event that runs past midnight
// is marked "+1" rather than silently showing an end time before its start.
function dayOffset(start, end) {
  const day = (d) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  return day(end) - day(start);
}

// The event's end, or null when it has none -- or when the one it carries is
// not after its start. A stored end can fall behind like that when the start of
// an imported event is moved in the form, which has no end field to move with
// it; showing "14:00 - 10:30" would be worse than showing no end at all.
export function eventEnd(event) {
  const start = asDate(event?.date);
  const end = asDate(event?.endDate);
  if (!start || !end) return null;
  return end > start ? end : null;
}

// The end time as it appears on screen, or null when there is none. An end on a
// later day keeps its "+1d" so an overnight event does not read as ending
// before it began. `pattern` is a date-fns one, matching whatever the caller
// uses for the start time.
export function formatEventEnd(event, pattern = 'HH:mm') {
  const end = eventEnd(event);
  if (!end) return null;
  const days = dayOffset(event.date instanceof Date ? event.date : new Date(event.date), end);
  return days > 0 ? `${format(end, pattern)} +${days}d` : format(end, pattern);
}

// How long an event runs, as words: "1 Std 15 Min". Pass the i18n helper to
// localize; without it the English form keeps the function usable outside
// React (and in tests).
export function formatDuration(event, { t } = {}) {
  const end = eventEnd(event);
  if (!end) return null;
  const start = event.date instanceof Date ? event.date : new Date(event.date);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (t) {
    if (h && m) return t('calendar.durationHM', { h, m });
    if (h) return t('calendar.durationH', { h });
    return t('calendar.durationM', { m });
  }
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}
