// Layout maths for the day timeline -- the hour grid that shows when a day's
// events sit and how long they run.
//
// Kept free of React so the awkward parts (an event running past midnight, three
// appointments overlapping, a feed event with no end at all) are testable.

import { eventEnd, isAllDay } from './eventTime';

// Pixels per hour. The grid is read at a glance on a phone, so an hour has to
// stay tall enough for a title to fit on one line.
export const HOUR_HEIGHT = 56;

// An event with no end still needs a block. This is how long it is drawn -- not
// what it is claimed to last, which is why nothing but the layout uses it.
export const ASSUMED_MINUTES = 60;

// Below this a block is too small to hold its own title.
export const MIN_BLOCK_MINUTES = 30;

function minutesOfDay(date, dayStart) {
  return Math.round((date.getTime() - dayStart.getTime()) / 60000);
}

// Where one event sits in the day, in minutes from midnight. `endMin` may run
// past 1440: an event that starts at 22:00 and ends at 01:00 belongs to the day
// it started on, and the grid clamps it rather than wrapping it around.
export function eventSpan(event, day) {
  const start = event?.date instanceof Date ? event.date : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const dayStart = new Date(
    (day || start).getFullYear(),
    (day || start).getMonth(),
    (day || start).getDate(),
  );
  const startMin = minutesOfDay(start, dayStart);
  const end = eventEnd(event);
  const endMin = end ? minutesOfDay(end, dayStart) : startMin + ASSUMED_MINUTES;
  return {
    startMin,
    endMin: Math.max(endMin, startMin + MIN_BLOCK_MINUTES),
    // What the block is actually claimed to last, as opposed to how tall it is
    // drawn: a 5-minute event is drawn 30 minutes tall but is not one.
    hasEnd: Boolean(end),
  };
}

// Split a day's events into the ones that belong in the strip above the grid
// -- all-day events, and the middle days of a longer run, which fill the whole
// day and would otherwise paint the entire grid -- and the ones that sit at a
// time.
export function splitAllDay(events, day) {
  const allDay = [];
  const timed = [];
  for (const event of events || []) {
    if (isAllDay(event)) {
      allDay.push(event);
      continue;
    }
    const span = eventSpan(event, day);
    if (span && span.hasEnd && span.startMin <= 0 && span.endMin >= 24 * 60) allDay.push(event);
    else timed.push(event);
  }
  return { allDay, timed };
}

// The minute of the day a tap at `offsetPx` into the grid points at, rounded
// down to the half hour so a new event starts on a sensible time.
export function minuteAtOffset(offsetPx, fromHour, step = 30) {
  const raw = fromHour * 60 + (Math.max(0, offsetPx) / HOUR_HEIGHT) * 60;
  return Math.min(24 * 60 - step, Math.floor(raw / step) * step);
}

// The hours the grid spans: everything the day's events touch, and never fewer
// than three rows, so a single short event does not produce a one-line grid.
export function timelineHours(spans) {
  const usable = (spans || []).filter(Boolean);
  if (!usable.length) return { fromHour: 8, toHour: 20 };
  const first = Math.min(...usable.map((s) => s.startMin));
  const last = Math.max(...usable.map((s) => s.endMin));
  let fromHour = Math.max(0, Math.floor(first / 60));
  let toHour = Math.min(24, Math.ceil(last / 60));
  while (toHour - fromHour < 3) {
    if (toHour < 24) toHour += 1;
    else if (fromHour > 0) fromHour -= 1;
    else break;
  }
  return { fromHour, toHour };
}

// Assign overlapping events to side-by-side lanes.
//
// Events are grouped into clusters of things that overlap (directly or through
// a chain), and every event in a cluster is drawn at the same width, so a row of
// three parallel appointments lines up instead of each block picking its own.
function assignLanes(items) {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out = [];
  let cluster = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (!cluster.length) return;
    const laneEnds = [];
    for (const item of cluster) {
      let lane = laneEnds.findIndex((end) => end <= item.startMin);
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(item.endMin);
      } else {
        laneEnds[lane] = item.endMin;
      }
      item.lane = lane;
    }
    for (const item of cluster) item.lanes = laneEnds.length;
    out.push(...cluster);
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of sorted) {
    if (item.startMin >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();
  return out;
}

// Everything the timeline needs to render one day: the hour rows, and a block
// per event with its offset, height and lane already worked out.
export function layoutDay(events, day) {
  const items = [];
  for (const event of events || []) {
    const span = eventSpan(event, day);
    if (span) items.push({ event, ...span });
  }
  const { fromHour, toHour } = timelineHours(items);
  const windowStart = fromHour * 60;
  const windowEnd = toHour * 60;

  const blocks = assignLanes(items).map((item) => {
    // An event running into the next day is cut off at the bottom of the grid;
    // its own card spells out the "+1d".
    const top = Math.max(0, item.startMin - windowStart);
    const bottom = Math.min(windowEnd - windowStart, item.endMin - windowStart);
    return {
      ...item,
      topPx: (top / 60) * HOUR_HEIGHT,
      heightPx: Math.max((MIN_BLOCK_MINUTES / 60) * HOUR_HEIGHT, ((bottom - top) / 60) * HOUR_HEIGHT),
      clipped: item.endMin > windowEnd,
    };
  });

  return {
    fromHour,
    toHour,
    hours: Array.from({ length: toHour - fromHour }, (_, i) => fromHour + i),
    heightPx: (toHour - fromHour) * HOUR_HEIGHT,
    blocks,
  };
}

// Offset of "now" inside the grid, or null when the day shown is not today (or
// the current time falls outside the hours on screen).
export function nowOffsetPx(day, fromHour, toHour, now = new Date()) {
  if (!(day instanceof Date)) return null;
  const sameDay = day.getFullYear() === now.getFullYear()
    && day.getMonth() === now.getMonth()
    && day.getDate() === now.getDate();
  if (!sameDay) return null;
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < fromHour * 60 || minutes > toHour * 60) return null;
  return ((minutes - fromHour * 60) / 60) * HOUR_HEIGHT;
}
