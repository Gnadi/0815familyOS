import { useEffect, useState } from 'react';

// One Firestore listener per (collection, family), shared by every component
// that asks for it -- the same pattern useEvents uses for the calendar.
//
// Before this, each hook instance opened its own onSnapshot. FoodPage and the
// weekly proposal on ShoppingPage both subscribed to recipes, meal plan and
// shopping items, and every route change tore the listeners down and rebuilt
// them: a full re-query, a full re-map and a spinner on every navigation.

// Route changes unmount the old screen before mounting the new one, so the
// subscriber count dips to zero in between. Lingering keeps the listener and
// its data alive across that gap instead of re-fetching everything.
export const LINGER_MS = 15000;

export const EMPTY_STATE = Object.freeze({ data: [], loading: false, error: null });
export const PENDING_STATE = Object.freeze({ data: [], loading: true, error: null });

// `subscribe(familyId, onData, onError)` must return an unsubscribe function.
// Returns a small store; the React binding is `useSharedCollection` below.
export function createSharedCollection(subscribe, { lingerMs = LINGER_MS } = {}) {
  const entries = new Map();

  function acquire(familyId) {
    const existing = entries.get(familyId);
    if (existing) {
      clearTimeout(existing.teardown);
      existing.teardown = null;
      return existing;
    }
    const entry = {
      familyId,
      state: PENDING_STATE,
      subscribers: new Set(),
      unsub: null,
      teardown: null,
    };
    const emit = (next) => {
      entry.state = next;
      entry.subscribers.forEach((notify) => notify(next));
    };
    entries.set(familyId, entry);
    entry.unsub = subscribe(
      familyId,
      (list) => emit({ data: list, loading: false, error: null }),
      // A failed listener has to end the loading state too, otherwise every
      // screen waiting on the first snapshot spins forever.
      (err) => emit({ data: entry.state.data, loading: false, error: err || new Error('Listener failed') }),
    );
    return entry;
  }

  function release(entry) {
    if (entry.subscribers.size > 0 || entry.teardown) return;
    entry.teardown = setTimeout(() => {
      entry.teardown = null;
      if (entry.subscribers.size > 0) return;
      entry.unsub?.();
      if (entries.get(entry.familyId) === entry) entries.delete(entry.familyId);
    }, lingerMs);
  }

  // Current state without subscribing (null when nothing is held).
  function peek(familyId) {
    return entries.get(familyId)?.state ?? null;
  }

  // Subscribe a plain callback; returns the unsubscribe function. The callback
  // is called synchronously with the current state.
  function listen(familyId, cb) {
    const entry = acquire(familyId);
    entry.subscribers.add(cb);
    cb(entry.state);
    return () => {
      entry.subscribers.delete(cb);
      release(entry);
    };
  }

  // Test helper: drop every listener immediately.
  function reset() {
    entries.forEach((entry) => {
      clearTimeout(entry.teardown);
      entry.unsub?.();
    });
    entries.clear();
  }

  return { acquire, release, peek, listen, reset, size: () => entries.size };
}

// React binding. Returns { data, loading, error }. A component mounting while
// the shared listener already holds data renders it on the first frame.
export function useSharedCollection(store, familyId) {
  const [state, setState] = useState(() => {
    if (!familyId) return EMPTY_STATE;
    return store.peek(familyId) || PENDING_STATE;
  });

  useEffect(() => {
    if (!familyId) {
      setState(EMPTY_STATE);
      return undefined;
    }
    return store.listen(familyId, setState);
  }, [store, familyId]);

  return state;
}
