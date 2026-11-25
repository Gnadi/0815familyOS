import { useEffect, useMemo, useState } from 'react';
import { createSharedCollection, useSharedCollection } from './sharedCollection';
import {
  fetchLatestTrackerEntry,
  subscribeRecentTrackerEntries,
  subscribeTrackerEntries,
  subscribeTrackers,
} from '../services/trackers';
import { localDayKey, startOfDayOffset } from '../utils/mergedListeners';

// Shared listeners (see sharedCollection.js): the Dashboard widget and the
// Tracker page reuse one subscription instead of re-querying on every visit.
const trackerStore = createSharedCollection(subscribeTrackers);
const entryStore = createSharedCollection(subscribeTrackerEntries);

// Definitions and their logged entries always arrive together: a card cannot
// render "last time" without both, and two separate loading flags would make
// the page flash a wrong "never logged" state between the snapshots.
export default function useTrackers(familyId) {
  const trackers = useSharedCollection(trackerStore, familyId);
  const entries = useSharedCollection(entryStore, familyId);
  return {
    trackers: trackers.data,
    entries: entries.data,
    loading: trackers.loading || entries.loading,
    error: trackers.error || entries.error,
  };
}

// ---------------------------------------------------------------------------
// The Dashboard's bounded view.
//
// The tracker cards show, per child, today's count against the goal and how
// long ago the last entry was. Neither needs the family's whole log, which
// grows by several entries a day for as long as the app is used. So the
// Dashboard listens to the last RECENT_DAYS days only, and for a card with no
// entry in that window fetches just its newest entry, once.

const RECENT_DAYS = 2;
// How long a fetched "newest entry" is reused across mounts. Only cards with
// nothing recent depend on it, and a new entry for them arrives through the
// live window anyway.
const LATEST_TTL_MS = 60 * 1000;

const recentStore = createSharedCollection((key, onData, onError) => {
  const [familyId, day] = key.split('|');
  const [y, m, d] = day.split('-').map(Number);
  return subscribeRecentTrackerEntries(familyId, startOfDayOffset(new Date(y, m - 1, d), RECENT_DAYS), onData, onError);
});

const latestCache = new Map();

function latestEntry(familyId, trackerId, kidId) {
  const key = `${familyId}|${trackerId}|${kidId}`;
  const cached = latestCache.get(key);
  if (cached && Date.now() - cached.at < LATEST_TTL_MS) return cached.promise;
  const promise = fetchLatestTrackerEntry(familyId, trackerId, kidId).catch((err) => {
    console.error('Latest tracker entry failed:', err);
    latestCache.delete(key);
    return null;
  });
  latestCache.set(key, { promise, at: Date.now() });
  return promise;
}

const NO_ENTRIES = [];

export function useRecentTrackers(familyId, kids) {
  const trackers = useSharedCollection(trackerStore, familyId);
  // The full log is a superset: reuse it when the Tracker page already has it.
  const [useFull] = useState(() => {
    const full = familyId ? entryStore.peek(familyId) : null;
    return Boolean(full && !full.loading && !full.error);
  });
  const full = useSharedCollection(entryStore, useFull ? familyId : null);
  const recent = useSharedCollection(recentStore, !useFull && familyId ? `${familyId}|${localDayKey(new Date())}` : null);
  const live = useFull ? full : recent;

  // Cards (tracker x child) with nothing in the live window.
  const missing = useMemo(() => {
    if (useFull || live.loading || trackers.loading) return [];
    const seen = new Set(live.data.map((e) => `${e.trackerId}|${e.kidId}`));
    const out = [];
    for (const kid of kids || []) {
      for (const tracker of trackers.data) {
        if (!tracker.kidIds?.includes(kid.id)) continue;
        if (!seen.has(`${tracker.id}|${kid.id}`)) out.push(`${tracker.id}|${kid.id}`);
      }
    }
    return out;
  }, [useFull, live.data, live.loading, trackers.data, trackers.loading, kids]);
  const missingKey = missing.join(',');

  const [older, setOlder] = useState({ key: null, entries: NO_ENTRIES });
  useEffect(() => {
    if (!familyId || !missingKey) {
      setOlder({ key: missingKey, entries: NO_ENTRIES });
      return undefined;
    }
    let cancelled = false;
    Promise.all(missingKey.split(',').map((pair) => {
      const [trackerId, kidId] = pair.split('|');
      return latestEntry(familyId, trackerId, kidId);
    })).then((list) => {
      if (!cancelled) setOlder({ key: missingKey, entries: list.filter(Boolean) });
    });
    return () => {
      cancelled = true;
    };
  }, [familyId, missingKey]);

  const olderReady = older.key === missingKey;
  const entries = useMemo(() => {
    if (!olderReady || older.entries.length === 0) return live.data;
    const ids = new Set(live.data.map((e) => e.id));
    return [...live.data, ...older.entries.filter((e) => !ids.has(e.id))];
  }, [live.data, older.entries, olderReady]);

  return {
    trackers: trackers.data,
    entries,
    loading: trackers.loading || live.loading || !olderReady,
    error: trackers.error || live.error,
  };
}
