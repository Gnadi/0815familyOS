import { describe, expect, it, vi } from 'vitest';
import { localDayKey, mergeListeners, startOfDayOffset } from '../../src/utils/mergedListeners';

vi.mock('../../src/lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(), collection: vi.fn(), deleteDoc: vi.fn(), doc: vi.fn(), setDoc: vi.fn(),
  getDocs: vi.fn(), onSnapshot: vi.fn(), orderBy: vi.fn(), query: vi.fn(), serverTimestamp: vi.fn(),
  Timestamp: { fromDate: (d) => d }, updateDoc: vi.fn(), where: vi.fn(), writeBatch: vi.fn(),
}));

function sources(n) {
  const calls = [];
  const list = Array.from({ length: n }, () => (onData, onError) => {
    const call = { onData, onError, unsub: vi.fn() };
    calls.push(call);
    return call.unsub;
  });
  return { list, calls };
}

describe('mergeListeners', () => {
  it('waits for every source before emitting, then merges by id', () => {
    const { list, calls } = sources(3);
    const cb = vi.fn();
    mergeListeners(list, cb, { sort: (a, b) => a.n - b.n });
    calls[0].onData([{ id: 'a', n: 2 }]);
    calls[1].onData([{ id: 'a', n: 2 }, { id: 'b', n: 1 }]);
    expect(cb).not.toHaveBeenCalled();
    calls[2].onData([]);
    expect(cb).toHaveBeenLastCalledWith([{ id: 'b', n: 1 }, { id: 'a', n: 2 }]);
  });

  it('re-emits on later snapshots and drops removed documents', () => {
    const { list, calls } = sources(2);
    const cb = vi.fn();
    mergeListeners(list, cb);
    calls[0].onData([{ id: 'a' }, { id: 'b' }]);
    calls[1].onData([{ id: 'c' }]);
    calls[0].onData([{ id: 'b' }]);
    expect(cb.mock.calls.at(-1)[0].map((x) => x.id).sort()).toEqual(['b', 'c']);
  });

  it('settles with an error from one source and reports it once', () => {
    const { list, calls } = sources(2);
    const cb = vi.fn();
    const onError = vi.fn();
    mergeListeners(list, cb, { onError });
    calls[0].onError(new Error('index missing'));
    calls[0].onError(new Error('again'));
    calls[1].onData([{ id: 'x' }]);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenLastCalledWith([{ id: 'x' }]);
  });

  it('unsubscribes every source', () => {
    const { list, calls } = sources(3);
    const stop = mergeListeners(list, vi.fn());
    stop();
    calls.forEach((c) => expect(c.unsub).toHaveBeenCalledTimes(1));
  });
});

describe('day helpers', () => {
  it('computes local day starts and keys', () => {
    const d = new Date(2026, 0, 3, 15, 30);
    expect(startOfDayOffset(d, 7)).toEqual(new Date(2025, 11, 27));
    expect(localDayKey(d)).toBe('2026-01-03');
  });
});

describe('reachesWindow', () => {
  it('keeps what can occur on or after the window start', async () => {
    const { reachesWindow } = await import('../../src/services/events');
    const since = new Date(2026, 10, 17);
    const old = new Date(2025, 0, 1);
    expect(reachesWindow({ date: new Date(2026, 10, 20) }, since)).toBe(true);
    expect(reachesWindow({ date: old }, since)).toBe(false);
    expect(reachesWindow({ date: old, recurrence: { freq: 'weekly' } }, since)).toBe(true);
    expect(reachesWindow({ date: old, endDate: new Date(2026, 10, 18) }, since)).toBe(true);
    expect(reachesWindow({ date: old, endDate: new Date(2026, 0, 2) }, since)).toBe(false);
    expect(reachesWindow({ date: old, source: 'annotation' }, since)).toBe(true);
  });
});
