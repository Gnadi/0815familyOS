import { useEffect, useMemo, useRef, useState } from 'react';
import { subscribeEvents, subscribeUpcomingEvents } from '../services/events';
import { localDayKey, startOfDayOffset, windowStartFor } from '../utils/mergedListeners';
import { loadAllFeeds, onFeedRefreshed } from '../services/calendarFeeds';
import { applyAnnotations, indexAnnotations } from '../utils/calendarSync';
import useAuth from './useAuth';

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

// Feeds are keyed by `familyId` for the full history and by
// `familyId|since|YYYY-MM-DD` for a window: every stored event that can occur
// on or after that day (see subscribeUpcomingEvents).
const UPCOMING_LOOKBACK_DAYS = 7;

function parseSince(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startFeed(key, onData, onError) {
  const [familyId, scope, day] = key.split('|');
  if (scope !== 'since') return subscribeEvents(familyId, onData, onError);
  return subscribeUpcomingEvents(familyId, parseSince(day), onData, onError);
}

export { windowStartFor };

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
  feed.unsub = startFeed(
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

// Read what the shared listener currently holds, without subscribing. Returns
// null when nothing is listening, so callers can fall back to a real query.
export function peekEvents(familyId) {
  if (!familyId) return null;
  const feed = feeds.get(familyId);
  if (!feed || feed.state.loading || feed.state.error) return null;
  return feed.state.events;
}

// Which shared feed serves a request. A loaded feed that covers more is reused
// rather than opening another listener: the full history serves everything,
// and a window starting earlier serves a later one. Otherwise the requested
// feed itself.
function resolveFeedKey(familyId, scope, sinceDay) {
  if (!familyId) return null;
  if (scope === 'all') return familyId;
  const settled = (feed) => feed && !feed.state.loading && !feed.state.error;
  if (settled(feeds.get(familyId))) return familyId;
  const wanted = `${familyId}|since|${sinceDay}`;
  if (feeds.has(wanted)) return wanted;
  for (const [key, feed] of feeds) {
    const [fid, scopeName, day] = key.split('|');
    if (fid === familyId && scopeName === 'since' && day <= sinceDay && settled(feed)) return key;
  }
  return wanted;
}

// The family's own events, straight from Firestore.
//
// When the window widens (the calendar pages back past what is loaded, or a
// search needs the whole history) the events already on screen stay there
// while the wider feed loads; `extending` says that is happening, for a small
// indicator instead of blanking the view.
function useStoredEvents(familyId, scope, sinceDay) {
  // Re-resolved only when the request changes, not on every render, so a
  // reused feed tearing down elsewhere cannot flip an open view to loading.
  const key = useMemo(
    () => resolveFeedKey(familyId, scope, sinceDay),
    [familyId, scope, sinceDay],
  );
  const [state, setState] = useState(() => {
    if (!key) return EMPTY;
    return feeds.get(key)?.state || PENDING;
  });
  const settledRef = useRef(null);

  useEffect(() => {
    if (!key) {
      setState(EMPTY);
      return undefined;
    }
    const feed = getFeed(key);
    feed.subscribers.add(setState);
    // Adopt whatever the shared feed already holds, so a component mounting
    // later renders immediately instead of showing a spinner again.
    setState(feed.state);
    return () => {
      feed.subscribers.delete(setState);
      releaseFeed(feed);
    };
  }, [key]);

  if (!state.loading) {
    settledRef.current = { familyId, state };
    return state;
  }
  const last = settledRef.current;
  if (last && last.familyId === familyId) return { ...last.state, extending: true };
  return state;
}

// Subscribed calendars, loaded from their .ics feeds. Shared across hook
// instances the same way the Firestore listener is, so mounting five
// components does not fetch five times.
const feedLoads = new Map();
let feedGeneration = 0;

// How long one in-memory load is shared before a remount re-runs it. The feed
// service has its own on-disk freshness window; this only keeps concurrent
// mounts from each firing a request.
const FEED_SHARE_MS = 5 * 60 * 1000;

function feedKey(subscriptions) {
  return (subscriptions || [])
    .map((s) => `${s?.id}:${s?.url}`)
    .sort()
    .join('|');
}

// Components already on screen have to notice an invalidation, so the
// generation counter is observable rather than just read at mount.
const generationListeners = new Set();

// Drop the cached load and make every mounted view reload. Used by the manual
// refresh and after a subscription is added or removed.
export function invalidateFeeds() {
  feedLoads.clear();
  feedGeneration += 1;
  generationListeners.forEach((notify) => notify(feedGeneration));
}

// A stale feed is served from its cache straight away and refreshed in the
// background; when that refresh changed anything, reload what is on screen.
// The reload reads the now-fresh cache, so it does not hit the network again.
onFeedRefreshed(() => invalidateFeeds());

function useFeedGeneration() {
  const [generation, setGeneration] = useState(feedGeneration);
  useEffect(() => {
    generationListeners.add(setGeneration);
    setGeneration(feedGeneration);
    return () => generationListeners.delete(setGeneration);
  }, []);
  return generation;
}

const NO_FEEDS = { events: [], loading: false, errors: [], reports: [] };

// The settled value of a shared load, if it is still within its share window.
// Reading it synchronously is what lets a remount (or a second component)
// render the feed events in its very first frame instead of flashing an empty
// calendar while an already-resolved promise goes through the microtask queue.
function settledLoad(cacheKey) {
  const cached = feedLoads.get(cacheKey);
  if (!cached || Date.now() - cached.at >= FEED_SHARE_MS) return null;
  return cached.value || null;
}

function useFeedEvents(subscriptions) {
  const key = feedKey(subscriptions);
  const generation = useFeedGeneration();
  const [state, setState] = useState(() => {
    if (!key) return NO_FEEDS;
    return settledLoad(`${generation}|${key}`) || { ...NO_FEEDS, loading: true };
  });

  useEffect(() => {
    if (!key) {
      setState(NO_FEEDS);
      return undefined;
    }
    let cancelled = false;
    const cacheKey = `${generation}|${key}`;
    const settled = settledLoad(cacheKey);
    if (settled) {
      setState(settled);
      return undefined;
    }
    // Shared across hook instances so mounting five components fetches once,
    // but not for the whole session: a long-lived tab should still pick up a
    // changed calendar.
    const cached = feedLoads.get(cacheKey);
    let load = cached && Date.now() - cached.at < FEED_SHARE_MS ? cached.promise : null;
    if (!load) {
      const entry = { promise: null, at: Date.now(), value: null };
      load = loadAllFeeds(subscriptions).then((res) => {
        entry.value = {
          events: res.events,
          loading: false,
          errors: res.errors,
          reports: res.reports || [],
        };
        return entry.value;
      });
      entry.promise = load;
      feedLoads.set(cacheKey, entry);
    }
    // A reload (sync, invalidation) keeps showing the events it has; only the
    // loading flag changes, so the calendar does not blank out meanwhile.
    setState((prev) => (prev.loading ? prev : { ...prev, loading: true }));
    load
      .then((value) => {
        if (!cancelled) setState(value);
      })
      .catch(() => {
        // loadAllFeeds settles per feed and never rejects, but a broken cache
        // read must not leave the calendar spinning.
        if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
      });
    return () => {
      cancelled = true;
    };
    // `subscriptions` is a fresh array on every family snapshot; `key` is its
    // stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, generation]);

  return state;
}

// `loading` covers the family's own events only. Subscribed calendars come
// from third-party servers that can take seconds to answer; waiting on them
// used to hide the family's own week behind "Loading events…". Their state is
// reported separately as `feedLoading`, for a small indicator.
//
// Which stored events to load:
//   scope 'all'      -- the whole history (search needs it).
//   scope 'upcoming' -- what can occur from a week ago onwards: the
//                       Dashboard's today / this week / next month.
//   scope 'since'    -- what can occur on or after `since` (a Date): the
//                       calendar's window, widened as it pages back, and the
//                       event form's conflict check around its date.
// A bounded scope is served from a wider feed when one is already loaded.
export default function useEvents(familyId, { scope = 'all', since = null } = {}) {
  const { family } = useAuth();
  let sinceDay = null;
  if (scope === 'upcoming') sinceDay = localDayKey(startOfDayOffset(new Date(), UPCOMING_LOOKBACK_DAYS));
  else if (scope === 'since' && since) sinceDay = localDayKey(since);
  const stored = useStoredEvents(familyId, sinceDay ? 'since' : 'all', sinceDay);
  const subscriptions = family?.id === familyId ? family?.calendarSubscriptions : null;
  const feed = useFeedEvents(subscriptions);

  return useMemo(() => {
    // Annotation documents are overlays, not calendar entries of their own.
    const ownEvents = stored.events.filter((ev) => ev.source !== 'annotation');
    const events = feed.events.length === 0
      ? ownEvents
      : [...ownEvents, ...applyAnnotations(feed.events, indexAnnotations(stored.events))];
    return {
      events,
      loading: stored.loading,
      // The window is widening (older months, or the full history for a
      // search); the events shown so far stay on screen meanwhile.
      extending: Boolean(stored.extending),
      feedLoading: feed.loading,
      error: stored.error,
      feedErrors: feed.errors,
      feedReports: feed.reports,
    };
  }, [
    stored.events,
    stored.loading,
    stored.extending,
    stored.error,
    feed.events,
    feed.loading,
    feed.errors,
    feed.reports,
  ]);
}
