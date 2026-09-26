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
import {
  cachedFeedReport,
  classifyFeed,
  FEED_NOT_CALENDAR,
  FEED_PAST_WINDOW_DAYS,
} from '../utils/feedDiagnostics';

// How long a cached feed is served before it is refetched. The cache is served
// immediately either way; a stale one just triggers a background refresh.
const FRESH_MS = 30 * 60 * 1000;

// Cached feeds survive a reload, so the calendar renders instantly and keeps
// working offline.
const CACHE_PREFIX = 'faos.feed.';
// Bumped when the cached event shape changes -- v1 entries predate `endDate`,
// v2 entries `allDay`, and serving them would keep a subscribed calendar
// without either until the feed happened to change upstream.
const CACHE_VERSION = 3;

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
      events: (parsed.events || []).map((ev) => ({
        ...ev,
        date: new Date(ev.date),
        endDate: ev.endDate ? new Date(ev.endDate) : null,
      })),
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
      events: entry.events.map((ev) => ({
        ...ev,
        date: ev.date.toISOString(),
        endDate: ev.endDate ? ev.endDate.toISOString() : null,
      })),
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
  cutoff.setDate(cutoff.getDate() - FEED_PAST_WINDOW_DAYS);

  const feed = selectSyncableEvents(
    dedupeFeedEvents(withStableUids(parsedEvents)),
    cutoff,
  );

  return feed.map((ev) => ({
    id: virtualEventId(subscription.id, ev.uid),
    title: ev.title || 'Untitled',
    description: ev.description || '',
    date: ev.date,
    endDate: ev.endDate || null,
    allDay: Boolean(ev.allDay),
    // The VEVENT's LOCATION. It was parsed all along and then dropped here, so
    // "Flughafen Hörsching" never reached the calendar.
    location: ev.location || '',
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
  if (fresh) {
    return { events: cached.events, fromCache: true, stale: false, report: cachedFeedReport(cached.events) };
  }

  try {
    const data = await fetchFeed(subscription, cached);
    if (data.notModified && cached) {
      // Unchanged upstream: keep the events, just restart the freshness clock.
      const entry = { ...cached, fetchedAt: Date.now() };
      writeCache(subscription, entry);
      return {
        events: entry.events,
        fromCache: true,
        stale: false,
        report: cachedFeedReport(entry.events),
      };
    }
    const parsed = parseICS(data.ics || '');
    const events = toFeedEvents(parsed.events, subscription);
    const report = classifyFeed({
      ics: data.ics,
      parsed: parsed.events,
      kept: events,
      calendarName: parsed.calendarName,
    });

    // Not a calendar at all -- almost always the wrong link out of a provider's
    // sharing settings (Google's HTML address, or a page that redirected to a
    // sign-in). Refusing it here is what makes "Test & subscribe" a real test:
    // it used to report success and leave the family with an empty calendar and
    // no hint as to why. Nothing is cached, so a corrected URL starts clean.
    if (report.code === FEED_NOT_CALENDAR) {
      const err = new Error('This URL does not return a calendar (.ics) file.');
      err.code = 'feed/not-calendar';
      err.report = report;
      throw err;
    }

    writeCache(subscription, {
      fetchedAt: Date.now(),
      etag: data.etag || null,
      lastModified: data.lastModified || null,
      events,
    });
    return { events, fromCache: false, stale: false, report };
  } catch (err) {
    // Offline or the provider is down: a stale cache beats an empty calendar.
    // A payload that is not a calendar is not that case -- there is nothing to
    // fall back to and the caller has to hear about it.
    if (cached && err.code !== 'feed/not-calendar') {
      return {
        events: cached.events,
        fromCache: true,
        stale: true,
        error: err,
        report: cachedFeedReport(cached.events),
      };
    }
    throw err;
  }
}

// Load every subscription of a family. One feed failing must not take the
// others (or the family's own events) down with it.
export async function loadAllFeeds(subscriptions, options) {
  // Filtered once, up front: `results` is index-aligned with this list and the
  // failure branch reads the subscription back out of it. Filtering a second
  // time further down is how a rejected feed used to be reported against the
  // wrong calendar.
  const live = (subscriptions || []).filter((sub) => sub?.id && sub?.url);
  const results = await Promise.allSettled(live.map((sub) => loadFeed(sub, options)));

  const events = [];
  const errors = [];
  // One entry per subscription, whatever happened to it. The calendar needs
  // this to say "Schule delivered nothing" instead of just showing an empty
  // week and leaving the family to guess.
  const reports = [];
  results.forEach((res, i) => {
    const subscription = live[i];
    if (res.status === 'fulfilled') {
      events.push(...res.value.events);
      if (res.value.error) errors.push({ subscription, error: res.value.error });
      reports.push({
        subscription,
        report: res.value.report || null,
        stale: Boolean(res.value.stale),
        error: res.value.error || null,
      });
    } else {
      errors.push({ subscription, error: res.reason });
      reports.push({
        subscription,
        report: res.reason?.report || null,
        stale: false,
        error: res.reason,
      });
    }
  });
  return { events, errors, reports };
}
