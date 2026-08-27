// Subscribed calendars, computed on the fly.
//
// Feeds are fetched, parsed and held in memory rather than mirrored into
// Firestore. A subscribed calendar costs zero reads, zero writes and zero
// storage, however often it is opened -- and because nothing is persisted,
// there is no copy to duplicate, strand or fail to delete.
//
// Feed events are shaped exactly like stored events (plus `source`,
// `subscriptionId` and `externalId`) so every view downstream treats them the
// same way.

import { parseICS } from '../utils/icsParser';
import {
  dedupeFeedEvents,
  selectSyncableEvents,
  virtualEventId,
  withStableUids,
} from '../utils/calendarSync';
import { DEFAULT_CATEGORY } from '../constants/eventCategories';

// How far back a feed is rendered. Anything older is history nobody scrolls to,
// and parsing it on every load costs time.
const PAST_WINDOW_DAYS = 365;

// How long a cached feed is served before it is refetched. The cache is served
// immediately either way; a stale one just triggers a background refresh.
const FRESH_MS = 30 * 60 * 1000;

// Cached feeds survive a reload, so the calendar renders instantly and keeps
// working offline.
const CACHE_PREFIX = 'faos.feed.';
const CACHE_VERSION = 1;

function cacheKey(subscriptionId) {
  return `${CACHE_PREFIX}${subscriptionId}`;
}

function readCache(subscription) {
  try {
    const raw = localStorage.getItem(cacheKey(subscription.id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== CACHE_VERSION) return null;
    // The URL is part of the identity: repointing a subscription must not serve
    // the previous calendar's events.
    if (parsed.url !== subscription.url) return null;
    return {
      fetchedAt: parsed.fetchedAt || 0,
      etag: parsed.etag || null,
      lastModified: parsed.lastModified || null,
      events: (parsed.events || []).map((ev) => ({ ...ev, date: new Date(ev.date) })),
    };
  } catch {
    // Unparseable, or storage unavailable (private mode). Treat as no cache.
    return null;
  }
}

function writeCache(subscription, entry) {
  try {
    localStorage.setItem(cacheKey(subscription.id), JSON.stringify({
      version: CACHE_VERSION,
      url: subscription.url,
      fetchedAt: entry.fetchedAt,
      etag: entry.etag,
      lastModified: entry.lastModified,
      events: entry.events.map((ev) => ({ ...ev, date: ev.date.toISOString() })),
    }));
  } catch {
    // Quota exceeded or storage unavailable -- the feed still works, it just
    // has to be refetched next time.
  }
}

export function clearFeedCache(subscriptionId) {
  try {
    localStorage.removeItem(cacheKey(subscriptionId));
  } catch {
    // Nothing to do; the cache is an optimisation, not state we depend on.
  }
}

// Turn parsed VEVENTs into the event shape the rest of the app renders.
function toFeedEvents(parsedEvents, subscription) {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - PAST_WINDOW_DAYS);

  const feed = selectSyncableEvents(
    dedupeFeedEvents(withStableUids(parsedEvents)),
    cutoff,
  );

  return feed.map((ev) => ({
    id: virtualEventId(subscription.id, ev.uid),
    title: ev.title || 'Untitled',
    description: ev.description || '',
    date: ev.date,
    recurrence: ev.recurrence || null,
    category: DEFAULT_CATEGORY,
    kids: [],
    responsibleParent: '',
    effortLevel: '',
    source: 'subscription',
    subscriptionId: subscription.id,
    subscriptionLabel: subscription.label || '',
    externalId: ev.uid,
  }));
}

async function fetchFeed(subscription, validators) {
  const res = await fetch('/api/ics-fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: subscription.url,
      etag: validators?.etag || null,
      lastModified: validators?.lastModified || null,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Fetch failed (${res.status}).`);
  }
  return res.json();
}

// Load one subscription's events.
//
// Returns { events, fromCache, stale } immediately from the cache when there is
// one, so nothing blocks on the network. Pass `force` to bypass freshness (the
// manual refresh button).
export async function loadFeed(subscription, { force = false } = {}) {
  const cached = readCache(subscription);
  const fresh = cached && !force && Date.now() - cached.fetchedAt < FRESH_MS;
  if (fresh) return { events: cached.events, fromCache: true, stale: false };

  try {
    const data = await fetchFeed(subscription, cached);
    if (data.notModified && cached) {
      // Unchanged upstream: keep the events, just restart the freshness clock.
      const entry = { ...cached, fetchedAt: Date.now() };
      writeCache(subscription, entry);
      return { events: entry.events, fromCache: true, stale: false };
    }
    const events = toFeedEvents(parseICS(data.ics || '').events, subscription);
    writeCache(subscription, {
      fetchedAt: Date.now(),
      etag: data.etag || null,
      lastModified: data.lastModified || null,
      events,
    });
    return { events, fromCache: false, stale: false };
  } catch (err) {
    // Offline or the provider is down: a stale cache beats an empty calendar.
    if (cached) return { events: cached.events, fromCache: true, stale: true, error: err };
    throw err;
  }
}

// Load every subscription of a family. One feed failing must not take the
// others (or the family's own events) down with it.
export async function loadAllFeeds(subscriptions, options) {
  const results = await Promise.allSettled(
    (subscriptions || [])
      .filter((sub) => sub?.id && sub?.url)
      .map(async (sub) => ({ sub, ...(await loadFeed(sub, options)) })),
  );

  const events = [];
  const errors = [];
  results.forEach((res, i) => {
    if (res.status === 'fulfilled') {
      events.push(...res.value.events);
      if (res.value.error) errors.push({ subscription: res.value.sub, error: res.value.error });
    } else {
      errors.push({ subscription: subscriptions[i], error: res.reason });
    }
  });
  return { events, errors };
}
