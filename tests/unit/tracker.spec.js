import { describe, expect, it } from 'vitest';
import {
  activeTrackerRows,
  cooldownUntil,
  countOnDay,
  entriesForTracker,
  groupEntriesByDay,
  isSameDay,
  relativeSince,
  sortEntriesDesc,
  sumOnDay,
  trackerStatus,
} from '../../src/utils/tracker';
import { TRACKER_COLOR_IDS, TRACKER_PRESETS, trackerColor } from '../../src/constants/trackerPresets';

const HOUR = 60 * 60 * 1000;

// A fixed "now" keeps the day-boundary assertions deterministic: 14:00 leaves
// room both backwards and forwards inside the same local day.
const NOW = new Date(2026, 2, 10, 14, 0, 0);
const ago = (ms) => new Date(NOW.getTime() - ms);

function entry(overrides = {}) {
  return { id: 'e1', trackerId: 't1', kidId: 'kid_a', at: NOW, value: null, note: '', ...overrides };
}

function tracker(overrides = {}) {
  return {
    id: 't1',
    name: 'Vitamin D',
    emoji: '☀️',
    color: 'amber',
    kidIds: ['kid_a'],
    unit: '',
    trackValue: false,
    dailyGoal: null,
    minIntervalHours: null,
    ...overrides,
  };
}

describe('isSameDay', () => {
  it('matches two times on the same local day', () => {
    expect(isSameDay(new Date(2026, 2, 10, 0, 1), new Date(2026, 2, 10, 23, 59))).toBe(true);
  });

  it('separates midnight from the minute before it', () => {
    expect(isSameDay(new Date(2026, 2, 10, 23, 59), new Date(2026, 2, 11, 0, 0))).toBe(false);
  });

  it('is false when either side is missing', () => {
    expect(isSameDay(null, NOW)).toBe(false);
    expect(isSameDay(NOW, undefined)).toBe(false);
  });
});

describe('entriesForTracker', () => {
  const entries = [
    entry({ id: 'a', trackerId: 't1', kidId: 'kid_a' }),
    entry({ id: 'b', trackerId: 't1', kidId: 'kid_b' }),
    entry({ id: 'c', trackerId: 't2', kidId: 'kid_a' }),
  ];

  it('keeps one child of a tracker shared by siblings', () => {
    expect(entriesForTracker(entries, 't1', 'kid_a').map((e) => e.id)).toEqual(['a']);
  });

  it('returns both children when no kid is given', () => {
    expect(entriesForTracker(entries, 't1', null).map((e) => e.id)).toEqual(['a', 'b']);
  });
});

describe('sortEntriesDesc', () => {
  it('puts the newest entry first', () => {
    const list = [
      entry({ id: 'old', at: ago(3 * HOUR) }),
      entry({ id: 'new', at: NOW }),
      entry({ id: 'mid', at: ago(HOUR) }),
    ];
    expect(sortEntriesDesc(list).map((e) => e.id)).toEqual(['new', 'mid', 'old']);
  });

  it('sorts an undated entry last instead of throwing', () => {
    const list = [entry({ id: 'undated', at: null }), entry({ id: 'dated', at: ago(HOUR) })];
    expect(sortEntriesDesc(list).map((e) => e.id)).toEqual(['dated', 'undated']);
  });

  it('does not mutate the input', () => {
    const list = [entry({ id: 'a', at: ago(HOUR) }), entry({ id: 'b', at: NOW })];
    sortEntriesDesc(list);
    expect(list.map((e) => e.id)).toEqual(['a', 'b']);
  });
});

describe('countOnDay / sumOnDay', () => {
  const entries = [
    entry({ id: 'a', at: ago(HOUR), value: 5 }),
    entry({ id: 'b', at: ago(6 * HOUR), value: 2.5 }),
    entry({ id: 'c', at: ago(30 * HOUR), value: 100 }),
  ];

  it('counts only today', () => {
    expect(countOnDay(entries, NOW)).toBe(2);
  });

  it('sums only today, rounded to two decimals', () => {
    expect(sumOnDay(entries, NOW)).toBe(7.5);
  });

  it('returns null when nothing numeric was logged today', () => {
    expect(sumOnDay([entry({ at: NOW, value: null })], NOW)).toBeNull();
  });
});

describe('relativeSince', () => {
  it('collapses under a minute to "now"', () => {
    expect(relativeSince(ago(30 * 1000), NOW)).toEqual({ unit: 'now', count: 0 });
  });

  it('reports whole minutes below an hour', () => {
    expect(relativeSince(ago(45 * 60 * 1000), NOW)).toEqual({ unit: 'minute', count: 45 });
  });

  it('rounds hours down, never up', () => {
    // 3 h 50 min is "3 hours ago" — rounding to 4 would misstate a dose.
    expect(relativeSince(ago(3 * HOUR + 50 * 60 * 1000), NOW)).toEqual({ unit: 'hour', count: 3 });
  });

  it('switches to days at 24 hours', () => {
    expect(relativeSince(ago(25 * HOUR), NOW)).toEqual({ unit: 'day', count: 1 });
  });

  it('handles a future timestamp without going negative', () => {
    expect(relativeSince(new Date(NOW.getTime() + HOUR), NOW)).toEqual({ unit: 'soon', count: 0 });
  });

  it('returns null for a missing date', () => {
    expect(relativeSince(null, NOW)).toBeNull();
  });
});

describe('cooldownUntil', () => {
  it('adds the interval to the last entry', () => {
    expect(cooldownUntil(ago(2 * HOUR), 6)).toEqual(new Date(NOW.getTime() + 4 * HOUR));
  });

  it('supports a fractional interval', () => {
    expect(cooldownUntil(NOW, 0.5)).toEqual(new Date(NOW.getTime() + 30 * 60 * 1000));
  });

  it('is null without an interval or without a last entry', () => {
    expect(cooldownUntil(NOW, null)).toBeNull();
    expect(cooldownUntil(null, 6)).toBeNull();
  });
});

describe('trackerStatus', () => {
  it('answers "when was the last time?"', () => {
    const entries = [
      entry({ id: 'recent', at: ago(3 * HOUR) }),
      entry({ id: 'older', at: ago(20 * HOUR) }),
    ];
    const status = trackerStatus(tracker(), entries, 'kid_a', NOW);
    expect(status.last.id).toBe('recent');
    expect(status.since).toEqual({ unit: 'hour', count: 3 });
  });

  it('answers "has this happened today?" against the daily goal', () => {
    const done = trackerStatus(tracker({ dailyGoal: 1 }), [entry({ at: ago(HOUR) })], 'kid_a', NOW);
    expect(done.goalMet).toBe(true);

    const notYet = trackerStatus(
      tracker({ dailyGoal: 1 }),
      [entry({ at: ago(26 * HOUR) })],
      'kid_a',
      NOW,
    );
    expect(notYet.todayCount).toBe(0);
    expect(notYet.goalMet).toBe(false);
  });

  it('flags whether the last entry was actually today', () => {
    // Guards a card reading "Today 0/1 · last at 08:15" for an entry logged
    // at 08:15 *yesterday*.
    expect(trackerStatus(tracker(), [entry({ at: ago(2 * HOUR) })], 'kid_a', NOW).lastWasToday).toBe(true);
    expect(trackerStatus(tracker(), [entry({ at: ago(30 * HOUR) })], 'kid_a', NOW).lastWasToday).toBe(false);
    expect(trackerStatus(tracker(), [], 'kid_a', NOW).lastWasToday).toBe(false);
  });

  it('only counts the selected child on a shared tracker', () => {
    const entries = [
      entry({ id: 'a', kidId: 'kid_a', at: ago(HOUR) }),
      entry({ id: 'b', kidId: 'kid_b', at: ago(HOUR) }),
      entry({ id: 'b2', kidId: 'kid_b', at: ago(2 * HOUR) }),
    ];
    expect(trackerStatus(tracker({ dailyGoal: 2 }), entries, 'kid_a', NOW).goalMet).toBe(false);
    expect(trackerStatus(tracker({ dailyGoal: 2 }), entries, 'kid_b', NOW).goalMet).toBe(true);
  });

  it('holds the cooldown open until the interval has passed', () => {
    const blocked = trackerStatus(
      tracker({ minIntervalHours: 6 }),
      [entry({ at: ago(2 * HOUR) })],
      'kid_a',
      NOW,
    );
    expect(blocked.cooldownActive).toBe(true);
    expect(blocked.cooldownUntil).toEqual(new Date(NOW.getTime() + 4 * HOUR));

    const due = trackerStatus(
      tracker({ minIntervalHours: 6 }),
      [entry({ at: ago(6 * HOUR) })],
      'kid_a',
      NOW,
    );
    expect(due.cooldownActive).toBe(false);
  });

  it('reports an empty tracker without a last entry', () => {
    const status = trackerStatus(tracker(), [], 'kid_a', NOW);
    expect(status.last).toBeNull();
    expect(status.since).toBeNull();
    expect(status.todayCount).toBe(0);
    expect(status.cooldownActive).toBe(false);
  });
});

describe('groupEntriesByDay', () => {
  it('buckets by local day, newest day first', () => {
    const groups = groupEntriesByDay([
      entry({ id: 'today1', at: ago(HOUR) }),
      entry({ id: 'yest', at: ago(26 * HOUR) }),
      entry({ id: 'today2', at: ago(6 * HOUR) }),
    ]);
    expect(groups.map((g) => g.entries.map((e) => e.id))).toEqual([
      ['today1', 'today2'],
      ['yest'],
    ]);
  });

  it('keeps undated entries in their own bucket', () => {
    const groups = groupEntriesByDay([entry({ id: 'a', at: NOW }), entry({ id: 'x', at: null })]);
    expect(groups[groups.length - 1]).toMatchObject({ key: 'unknown', day: null });
  });
});

describe('activeTrackerRows', () => {
  const kids = [
    { id: 'kid_a', name: 'Anna' },
    { id: 'kid_b', name: 'Lukas' },
  ];

  it('gives a shared tracker one row per child', () => {
    const shared = tracker({ id: 'shared', kidIds: ['kid_a', 'kid_b'] });
    const rows = activeTrackerRows([shared], [], kids, NOW);
    expect(rows.map((r) => r.kid.id)).toEqual(['kid_a', 'kid_b']);
    expect(rows.map((r) => r.key)).toEqual(['shared:kid_a', 'shared:kid_b']);
  });

  it('skips children the tracker does not belong to', () => {
    const rows = activeTrackerRows([tracker({ kidIds: ['kid_b'] })], [], kids, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].kid.id).toBe('kid_b');
  });

  it('puts an unmet daily goal above a running cooldown above the rest', () => {
    const owed = tracker({ id: 'owed', dailyGoal: 1 });
    const cooling = tracker({ id: 'cooling', minIntervalHours: 6 });
    const plain = tracker({ id: 'plain' });
    const entries = [
      entry({ id: 'c', trackerId: 'cooling', at: ago(2 * HOUR) }),
      entry({ id: 'p', trackerId: 'plain', at: ago(HOUR) }),
    ];
    const rows = activeTrackerRows([plain, cooling, owed], entries, [kids[0]], NOW);
    expect(rows.map((r) => r.tracker.id)).toEqual(['owed', 'cooling', 'plain']);
  });

  it('drops a met goal out of the top slot', () => {
    const met = tracker({ id: 'met', dailyGoal: 1 });
    const owed = tracker({ id: 'owed', dailyGoal: 1 });
    const entries = [entry({ id: 'm', trackerId: 'met', at: ago(HOUR) })];
    const rows = activeTrackerRows([met, owed], entries, [kids[0]], NOW);
    expect(rows.map((r) => r.tracker.id)).toEqual(['owed', 'met']);
  });

  it('orders equals by most recently logged, never-logged last', () => {
    const entries = [
      entry({ id: 'old', trackerId: 'a', at: ago(5 * HOUR) }),
      entry({ id: 'new', trackerId: 'b', at: ago(HOUR) }),
    ];
    const rows = activeTrackerRows(
      [tracker({ id: 'a' }), tracker({ id: 'b' }), tracker({ id: 'never' })],
      entries,
      [kids[0]],
      NOW,
    );
    expect(rows.map((r) => r.tracker.id)).toEqual(['b', 'a', 'never']);
  });
});

describe('tracker presets', () => {
  it('only references colours that have Tailwind classes', () => {
    for (const preset of TRACKER_PRESETS) {
      expect(TRACKER_COLOR_IDS).toContain(preset.color);
    }
  });

  it('falls back to the brand colour for an unknown id', () => {
    expect(trackerColor('not-a-colour')).toBe(trackerColor('brand'));
  });
});
