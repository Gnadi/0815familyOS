import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSharedCollection } from '../../src/hooks/sharedCollection';

function fakeSource() {
  const calls = [];
  const subscribe = vi.fn((familyId, onData, onError) => {
    const call = { familyId, onData, onError, unsub: vi.fn() };
    calls.push(call);
    return call.unsub;
  });
  return { subscribe, calls };
}

describe('createSharedCollection', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens one listener per family no matter how many callers', () => {
    const src = fakeSource();
    const store = createSharedCollection(src.subscribe);
    const a = vi.fn();
    const b = vi.fn();
    store.listen('fam', a);
    store.listen('fam', b);
    expect(src.subscribe).toHaveBeenCalledTimes(1);
    src.calls[0].onData([1, 2]);
    expect(a).toHaveBeenLastCalledWith({ data: [1, 2], loading: false, error: null });
    expect(b).toHaveBeenLastCalledWith({ data: [1, 2], loading: false, error: null });
  });

  it('hands a late subscriber the current data synchronously', () => {
    const src = fakeSource();
    const store = createSharedCollection(src.subscribe);
    store.listen('fam', () => {});
    src.calls[0].onData(['x']);
    const late = vi.fn();
    store.listen('fam', late);
    expect(late).toHaveBeenCalledWith({ data: ['x'], loading: false, error: null });
    expect(store.peek('fam').data).toEqual(['x']);
  });

  it('lingers after the last caller leaves and is reused on a quick return', () => {
    const src = fakeSource();
    const store = createSharedCollection(src.subscribe, { lingerMs: 1000 });
    const off = store.listen('fam', () => {});
    off();
    vi.advanceTimersByTime(500);
    store.listen('fam', () => {});
    vi.advanceTimersByTime(5000);
    expect(src.subscribe).toHaveBeenCalledTimes(1);
    expect(src.calls[0].unsub).not.toHaveBeenCalled();
  });

  it('tears the listener down once the linger expires', () => {
    const src = fakeSource();
    const store = createSharedCollection(src.subscribe, { lingerMs: 1000 });
    const off = store.listen('fam', () => {});
    off();
    vi.advanceTimersByTime(1001);
    expect(src.calls[0].unsub).toHaveBeenCalledTimes(1);
    expect(store.peek('fam')).toBeNull();
    store.listen('fam', () => {});
    expect(src.subscribe).toHaveBeenCalledTimes(2);
  });

  it('ends the loading state when the listener fails, keeping old data', () => {
    const src = fakeSource();
    const store = createSharedCollection(src.subscribe);
    const cb = vi.fn();
    store.listen('fam', cb);
    expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ loading: true }));
    src.calls[0].onData(['kept']);
    const err = new Error('permission-denied');
    src.calls[0].onError(err);
    expect(cb).toHaveBeenLastCalledWith({ data: ['kept'], loading: false, error: err });
  });

  it('keeps families apart', () => {
    const src = fakeSource();
    const store = createSharedCollection(src.subscribe);
    store.listen('a', () => {});
    store.listen('b', () => {});
    expect(src.subscribe).toHaveBeenCalledTimes(2);
    expect(store.size()).toBe(2);
  });
});
