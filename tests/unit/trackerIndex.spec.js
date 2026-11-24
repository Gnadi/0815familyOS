import { describe, expect, it } from 'vitest';
import {
  activeTrackerRows,
  entriesForTracker,
  indexTrackerEntries,
  sortEntriesDesc,
  trackerEntriesFor,
  trackerStatus,
} from '../../src/utils/tracker';

const at = (s) => new Date(s);

function makeEntries() {
  return [
    { id: '1', trackerId: 't1', kidId: 'k1', at: at('2026-03-10T08:00:00'), value: 2 },
    { id: '2', trackerId: 't1', kidId: 'k2', at: at('2026-03-10T09:00:00'), value: 1 },
    { id: '3', trackerId: 't1', kidId: 'k1', at: at('2026-03-09T20:00:00') },
    { id: '4', trackerId: 't2', kidId: 'k1', at: at('2026-03-10T07:00:00') },
    { id: '5', trackerId: 't1', kidId: 'k1', at: at('2026-03-10T12:30:00'), value: 0.5 },
    { id: '6', trackerId: 't1', kidId: 'k1', at: null },
    // A future entry on the next day must not count for today.
    { id: '7', trackerId: 't1', kidId: 'k1', at: at('2026-03-11T06:00:00') },
  ];
}

describe('tracker entry index', () => {
  it('matches the plain filter+sort for every tracker/kid', () => {
    const entries = makeEntries();
    for (const tid of ['t1', 't2', 'tX']) {
      for (const kid of ['k1', 'k2', undefined]) {
        expect(trackerEntriesFor(entries, tid, kid).map((e) => e.id))
          .toEqual(sortEntriesDesc(entriesForTracker(entries, tid, kid)).map((e) => e.id));
      }
    }
  });

  it('is built once per entries array', () => {
    const entries = makeEntries();
    expect(indexTrackerEntries(entries)).toBe(indexTrackerEntries(entries));
    expect(indexTrackerEntries([...entries])).not.toBe(indexTrackerEntries(entries));
  });

  it('counts and sums only the day being looked at', () => {
    const entries = makeEntries();
    const status = trackerStatus({ id: 't1', dailyGoal: 3 }, entries, 'k1', at('2026-03-10T18:00:00'));
    expect(status.todayCount).toBe(2);
    expect(status.todaySum).toBe(2.5);
    expect(status.goalMet).toBe(false);
    expect(status.last.id).toBe('7');
  });

  it('returns a null sum when nothing numeric was logged that day', () => {
    const entries = makeEntries();
    const status = trackerStatus({ id: 't2' }, entries, 'k1', at('2026-03-10T18:00:00'));
    expect(status.todayCount).toBe(1);
    expect(status.todaySum).toBeNull();
  });

  it('keeps activeTrackerRows working off the index', () => {
    const entries = makeEntries();
    const rows = activeTrackerRows(
      [{ id: 't1', kidIds: ['k1', 'k2'], dailyGoal: 1 }, { id: 't2', kidIds: ['k1'] }],
      entries,
      [{ id: 'k1' }, { id: 'k2' }],
      at('2026-03-10T18:00:00'),
    );
    expect(rows.map((r) => r.key).sort()).toEqual(['t1:k1', 't1:k2', 't2:k1']);
  });
});
