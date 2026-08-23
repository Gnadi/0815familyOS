import { describe, expect, it } from 'vitest';
import { dayKey, groupEventsByDay, NO_EVENTS } from '../../src/utils/date';
import { expandEventsInRange } from '../../src/utils/recurrence';

const at = (y, m, d, h = 9, min = 0) => new Date(y, m - 1, d, h, min, 0);

describe('dayKey', () => {
  it('is equal for two times on the same local day', () => {
    expect(dayKey(at(2026, 3, 4, 0, 1))).toBe(dayKey(at(2026, 3, 4, 23, 59)));
  });

  it('differs across days, months and years', () => {
    expect(dayKey(at(2026, 3, 4))).not.toBe(dayKey(at(2026, 3, 5)));
    expect(dayKey(at(2026, 3, 4))).not.toBe(dayKey(at(2026, 4, 4)));
    expect(dayKey(at(2026, 3, 4))).not.toBe(dayKey(at(2027, 3, 4)));
  });

  it('does not confuse days whose numbers concatenate alike', () => {
    // "2026-1-11" vs "2026-11-1" must not collide.
    expect(dayKey(at(2026, 2, 11))).not.toBe(dayKey(at(2026, 12, 1)));
  });

  it('returns an empty key for a missing or invalid date', () => {
    expect(dayKey(undefined)).toBe('');
    expect(dayKey(new Date('nonsense'))).toBe('');
  });
});

describe('groupEventsByDay', () => {
  it('buckets events under their own day', () => {
    const a = { id: 'a', date: at(2026, 3, 4, 10) };
    const b = { id: 'b', date: at(2026, 3, 4, 8) };
    const c = { id: 'c', date: at(2026, 3, 5, 9) };
    const byDay = groupEventsByDay([a, b, c]);
    expect(byDay.get(dayKey(a.date)).map((e) => e.id)).toEqual(['b', 'a']);
    expect(byDay.get(dayKey(c.date)).map((e) => e.id)).toEqual(['c']);
  });

  it('sorts each day by time', () => {
    const byDay = groupEventsByDay([
      { id: 'late', date: at(2026, 3, 4, 20) },
      { id: 'early', date: at(2026, 3, 4, 7) },
      { id: 'noon', date: at(2026, 3, 4, 12) },
    ]);
    expect(byDay.get(dayKey(at(2026, 3, 4))).map((e) => e.id)).toEqual([
      'early',
      'noon',
      'late',
    ]);
  });

  it('skips events without a usable date', () => {
    const byDay = groupEventsByDay([{ id: 'x' }, { id: 'y', date: new Date('nope') }]);
    expect(byDay.size).toBe(0);
  });

  it('has no bucket for an empty day, so lookups fall back cleanly', () => {
    const byDay = groupEventsByDay([{ id: 'a', date: at(2026, 3, 4) }]);
    expect(byDay.get(dayKey(at(2026, 3, 9))) || NO_EVENTS).toEqual([]);
  });

  it('produces the same buckets a per-day filter would, in one pass', () => {
    const events = Array.from({ length: 200 }, (_, i) => ({
      id: `e${i}`,
      date: at(2026, 3, (i % 28) + 1, 8 + (i % 10)),
    }));
    const byDay = groupEventsByDay(events);
    for (let day = 1; day <= 28; day += 1) {
      const key = dayKey(at(2026, 3, day));
      const expected = events
        .filter((e) => dayKey(e.date) === key)
        .sort((a, b) => a.date - b.date)
        .map((e) => e.id);
      expect((byDay.get(key) || NO_EVENTS).map((e) => e.id)).toEqual(expected);
    }
  });

  it('groups expanded recurring occurrences onto their own days', () => {
    const master = {
      id: 'weekly',
      date: at(2026, 3, 2, 16),
      recurrence: { freq: 'weekly', interval: 1 },
    };
    const expanded = expandEventsInRange(
      [master],
      new Date(2026, 2, 1),
      new Date(2026, 2, 31, 23, 59, 59),
    );
    const byDay = groupEventsByDay(expanded);
    // Mondays in March 2026: 2, 9, 16, 23, 30.
    expect([...byDay.keys()]).toHaveLength(5);
    for (const day of [2, 9, 16, 23, 30]) {
      expect(byDay.get(dayKey(at(2026, 3, day, 16)))).toHaveLength(1);
    }
  });
});
