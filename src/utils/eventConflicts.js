// Double bookings: another event at the same time for the same child or the
// same responsible parent. The event form warns about them while it is being
// filled in; nothing stops the family from saving anyway.
//
// All-day events are left out on both sides. A birthday or a school holiday
// runs alongside the day's appointments rather than clashing with them.

import { expandEventsInRange, isValidRecurrence } from './recurrence';
import { eventEnd, isAllDay } from './eventTime';

// How long an event without an end is taken to last -- the same hour the day
// timeline draws it as.
const ASSUMED_MS = 60 * 60 * 1000;

function endOf(event) {
  return eventEnd(event) || new Date(event.date.getTime() + ASSUMED_MS);
}

// `candidate` is the event as the form currently describes it: { date,
// endDate?, allDay?, kids, responsibleParent }. `ignoreId` is the event being
// edited, so it does not clash with itself; for a series every occurrence of
// it is ignored.
//
// Returns [{ event, kids: [sharedKidIds], parent: boolean }], in start order.
export function findConflicts(events, candidate, { ignoreId = null } = {}) {
  const start = candidate?.date;
  if (!(start instanceof Date) || Number.isNaN(start.getTime()) || candidate.allDay) return [];
  const kids = candidate.kids || [];
  const parent = candidate.responsibleParent || '';
  if (!kids.length && !parent) return [];

  const end = candidate.endDate instanceof Date && candidate.endDate > start
    ? candidate.endDate
    : new Date(start.getTime() + ASSUMED_MS);

  // A day either side, so an overnight event that started the evening before
  // is still looked at.
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
  const to = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);

  // Narrow the list before expanding anything. An occurrence carries its
  // master's kids, parent and all-day flag, so a series that shares nobody with
  // the candidate cannot clash on any date; a one-off that starts after the
  // window cannot either. The form recomputes this on every change, and
  // expanding the family's whole history each time was most of the cost.
  const relevant = [];
  for (const ev of events || []) {
    if (!(ev?.date instanceof Date) || ev.source === 'annotation' || isAllDay(ev)) continue;
    if (ignoreId && ev.id === ignoreId) continue;
    const sharesKid = kids.length > 0 && (ev.kids || []).some((id) => kids.includes(id));
    if (!sharesKid && !(parent && ev.responsibleParent === parent)) continue;
    if (!isValidRecurrence(ev.recurrence) && ev.date > to) continue;
    relevant.push(ev);
  }

  const out = [];
  for (const ev of expandEventsInRange(relevant, from, to)) {
    if (!(ev.date instanceof Date) || isAllDay(ev)) continue;
    if (ev.source === 'annotation') continue;
    if (ignoreId && (ev.id === ignoreId || ev.masterId === ignoreId)) continue;
    if (!(ev.date < end && endOf(ev) > start)) continue;
    const sharedKids = (ev.kids || []).filter((id) => kids.includes(id));
    const sameParent = Boolean(parent) && ev.responsibleParent === parent;
    if (sharedKids.length || sameParent) out.push({ event: ev, kids: sharedKids, parent: sameParent });
  }
  return out.sort((a, b) => a.event.date - b.event.date);
}
