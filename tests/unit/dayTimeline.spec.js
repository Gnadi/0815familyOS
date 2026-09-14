import { describe, expect, it } from 'vitest';
import {
  ASSUMED_MINUTES,
  HOUR_HEIGHT,
  eventSpan,
  layoutDay,
  nowOffsetPx,
  timelineHours,
} from '../../src/utils/dayTimeline';
import { formatDuration } from '../../src/utils/eventTime';

const day = new Date(2026, 8, 15);
const at = (h, m = 0) => new Date(2026, 8, 15, h, m);
const ev = (id, start, end, extra = {}) => ({ id, title: id, date: start, endDate: end, ...extra });

describe('eventSpan', () => {
  it('measures an event in minutes from midnight', () => {
    expect(eventSpan(ev('a', at(17, 0), at(18, 0)), day)).toMatchObject({
      startMin: 17 * 60,
      endMin: 18 * 60,
      hasEnd: true,
    });
  });

  it('gives an event without an end an assumed block', () => {
    const span = eventSpan(ev('b', at(9, 0), null), day);
    expect(span.endMin - span.startMin).toBe(ASSUMED_MINUTES);
    expect(span.hasEnd).toBe(false);
  });

  it('keeps a five-minute event tall enough to read', () => {
    const span = eventSpan(ev('c', at(9, 0), at(9, 5)), day);
    expect(span.endMin - span.startMin).toBe(30);
    // Drawn 30 minutes tall, but still a five-minute event.
    expect(span.hasEnd).toBe(true);
  });

  it('runs an overnight event past the end of the day rather than wrapping it', () => {
    const span = eventSpan(ev('d', at(22, 0), new Date(2026, 8, 16, 1, 0)), day);
    expect(span.startMin).toBe(22 * 60);
    expect(span.endMin).toBe(25 * 60);
  });

  it('is null without a usable start', () => {
    expect(eventSpan({ id: 'x' }, day)).toBeNull();
    expect(eventSpan({ id: 'x', date: new Date('nonsense') }, day)).toBeNull();
  });
});

describe('timelineHours', () => {
  it('spans the hours the day actually uses', () => {
    const spans = [
      eventSpan(ev('a', at(9, 30), at(10, 15)), day),
      eventSpan(ev('b', at(16, 0), at(17, 45)), day),
    ];
    expect(timelineHours(spans)).toEqual({ fromHour: 9, toHour: 18 });
  });

  it('never collapses to fewer than three rows', () => {
    const { fromHour, toHour } = timelineHours([eventSpan(ev('a', at(10, 0), at(10, 30)), day)]);
    expect(toHour - fromHour).toBeGreaterThanOrEqual(3);
  });

  it('falls back to a working day when there is nothing to show', () => {
    expect(timelineHours([])).toEqual({ fromHour: 8, toHour: 20 });
  });
});

describe('layoutDay', () => {
  it('places a block at its start, as tall as it runs', () => {
    const { fromHour, blocks } = layoutDay([ev('a', at(17, 0), at(18, 0))], day);
    expect(fromHour).toBe(17);
    expect(blocks[0].topPx).toBe(0);
    expect(blocks[0].heightPx).toBe(HOUR_HEIGHT);
    expect(blocks[0].lanes).toBe(1);
  });

  it('puts overlapping events in side-by-side lanes', () => {
    const { blocks } = layoutDay([
      ev('a', at(9, 0), at(11, 0)),
      ev('b', at(10, 0), at(12, 0)),
    ], day);
    const byId = Object.fromEntries(blocks.map((b) => [b.event.id, b]));
    expect(byId.a.lane).toBe(0);
    expect(byId.b.lane).toBe(1);
    // Both are drawn at the same width, so the pair lines up.
    expect(byId.a.lanes).toBe(2);
    expect(byId.b.lanes).toBe(2);
  });

  it('reuses a lane once the event in it has ended', () => {
    const { blocks } = layoutDay([
      ev('a', at(9, 0), at(10, 0)),
      ev('b', at(9, 30), at(12, 0)),
      ev('c', at(10, 30), at(11, 0)),
    ], day);
    const byId = Object.fromEntries(blocks.map((b) => [b.event.id, b]));
    expect(byId.c.lane).toBe(0);
    expect(byId.a.lanes).toBe(2);
  });

  it('keeps events that never overlap in one lane each', () => {
    const { blocks } = layoutDay([
      ev('a', at(9, 0), at(10, 0)),
      ev('b', at(14, 0), at(15, 0)),
    ], day);
    expect(blocks.every((b) => b.lanes === 1 && b.lane === 0)).toBe(true);
  });

  it('cuts an overnight event off at the bottom and says so', () => {
    const { toHour, heightPx, blocks } = layoutDay(
      [ev('a', at(22, 0), new Date(2026, 8, 16, 1, 0))],
      day,
    );
    // The grid stops at midnight; the block runs all the way down to it and is
    // marked clipped, so the card's own "+1d" carries the rest.
    expect(toHour).toBe(24);
    expect(blocks[0].clipped).toBe(true);
    expect(blocks[0].topPx).toBe(HOUR_HEIGHT);
    expect(blocks[0].topPx + blocks[0].heightPx).toBe(heightPx);
  });

  it('skips events it cannot place', () => {
    expect(layoutDay([{ id: 'x' }], day).blocks).toHaveLength(0);
  });
});

describe('nowOffsetPx', () => {
  it('marks the current time on today', () => {
    const now = new Date(2026, 8, 15, 10, 30);
    expect(nowOffsetPx(day, 9, 18, now)).toBe(1.5 * HOUR_HEIGHT);
  });

  it('is null on any other day, and outside the hours shown', () => {
    expect(nowOffsetPx(new Date(2026, 8, 16), 9, 18, new Date(2026, 8, 15, 10, 30))).toBeNull();
    expect(nowOffsetPx(day, 9, 18, new Date(2026, 8, 15, 6, 0))).toBeNull();
  });
});

describe('formatDuration', () => {
  it('spells out hours and minutes', () => {
    expect(formatDuration(ev('a', at(17, 0), at(18, 15)))).toBe('1 h 15 min');
    expect(formatDuration(ev('b', at(17, 0), at(19, 0)))).toBe('2 h');
    expect(formatDuration(ev('c', at(17, 0), at(17, 45)))).toBe('45 min');
  });

  it('uses the translations it is given', () => {
    const t = (key, vars) => `${key}:${JSON.stringify(vars)}`;
    expect(formatDuration(ev('a', at(17, 0), at(18, 15)), { t }))
      .toBe('calendar.durationHM:{"h":1,"m":15}');
  });

  it('is null without an end', () => {
    expect(formatDuration(ev('a', at(17, 0), null))).toBeNull();
  });
});
