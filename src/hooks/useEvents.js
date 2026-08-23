import { useEffect, useState } from 'react';
import { subscribeEvents } from '../services/events';

// One Firestore listener per family, shared by every component that asks for
// the events.
//
// Each call to this hook used to open its own onSnapshot on the whole events
// collection. The dashboard alone mounts three of them (DailyPreview,
// WeeklyPreview, WorkloadBalance), so the entire collection was downloaded,
// mapped into JS objects and re-rendered three times over for exactly the same
// data -- and a fourth time when the calendar opened.
const feeds = new Map();

// Route changes unmount the old screen before mounting the new one, so the
// subscriber count dips to zero in between. Lingering briefly keeps the
// listener (and its data) alive across that gap instead of tearing it down and
// immediately re-fetching everything.
const LINGER_MS = 15000;

const EMPTY = { events: [], loading: false, error: null };
const PENDING = { events: [], loading: true, error: null };

function getFeed(familyId) {
  const existing = feeds.get(familyId);
  if (existing) {
    clearTimeout(existing.teardown);
    existing.teardown = null;
    return existing;
  }

  const feed = {
    familyId,
    state: PENDING,
    subscribers: new Set(),
    unsub: null,
    teardown: null,
  };
  const emit = (next) => {
    feed.state = next;
    feed.subscribers.forEach((notify) => notify(next));
  };
  feeds.set(familyId, feed);
  feed.unsub = subscribeEvents(
    familyId,
    (list) => emit({ events: list, loading: false, error: null }),
    // A failed listener has to end the loading state too, otherwise every
    // screen waiting on the first snapshot stays on its spinner indefinitely.
    (err) => emit({ events: feed.state.events, loading: false, error: err }),
  );
  return feed;
}

function releaseFeed(feed) {
  if (feed.subscribers.size > 0 || feed.teardown) return;
  feed.teardown = setTimeout(() => {
    if (feed.subscribers.size > 0) {
      feed.teardown = null;
      return;
    }
    feed.unsub?.();
    feeds.delete(feed.familyId);
  }, LINGER_MS);
}

// Read what the shared listener currently holds, without subscribing.
//
// The live listener has already paid the Firestore reads for every event of the
// family. Background jobs (the subscription sync, the orphan sweep) would
// otherwise re-read the whole collection with getDocs and pay for all of it a
// second time, several times a day. Returns null when nothing is listening, so
// callers can fall back to a real query.
export function peekEvents(familyId) {
  if (!familyId) return null;
  const feed = feeds.get(familyId);
  if (!feed || feed.state.loading || feed.state.error) return null;
  return feed.state.events;
}

export default function useEvents(familyId) {
  const [state, setState] = useState(() => {
    if (!familyId) return EMPTY;
    return feeds.get(familyId)?.state || PENDING;
  });

  useEffect(() => {
    if (!familyId) {
      setState(EMPTY);
      return undefined;
    }
    const feed = getFeed(familyId);
    feed.subscribers.add(setState);
    // Adopt whatever the shared feed already holds, so a component mounting
    // later renders immediately instead of showing a spinner again.
    setState(feed.state);
    return () => {
      feed.subscribers.delete(setState);
      releaseFeed(feed);
    };
  }, [familyId]);

  return state;
}
