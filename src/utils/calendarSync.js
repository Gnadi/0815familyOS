// Helpers for syncing an external calendar subscription into our events
// collection. Deliberately free of Firebase imports so they stay unit-testable
// and can be reused from both the sync and the one-time file import.

// FNV-1a, 32 bit. Run twice with different offset bases so two independent
// 32-bit values can be concatenated into a 64-bit key -- enough to keep derived
// document ids collision-free for any realistic calendar.
function fnv1a(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function hex8(n) {
  return n.toString(16).padStart(8, '0');
}

// Stable 64-bit hex digest of an arbitrary string.
export function stableHash(str) {
  const s = String(str);
  return `${hex8(fnv1a(s, 0x811c9dc5))}${hex8(fnv1a(s, 0x9e3779b1))}`;
}

// Firestore document ids may not contain "/", may not be "." or "..", and may
// not match __.*__. Keeping only [A-Za-z0-9_-] satisfies all of that.
function slug(value, max) {
  return String(value || '')
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, max);
}

// Deterministic document id for one event of one subscription.
//
// This is the core of the de-duplication: two syncs racing each other (the
// initial sync from Settings and the background sync in AppShell, or two open
// browser tabs) write to the *same* document instead of each creating one, so
// duplicates can no longer be created in the first place.
export function subscriptionEventId(subscriptionId, uid) {
  const key = `${subscriptionId} ${uid}`;
  return `ics_${slug(subscriptionId, 32)}_${slug(uid, 48)}_${stableHash(key)}`;
}

// Some feeds ship VEVENTs without a UID. Deriving a stable one from the event's
// own content keeps those importable *and* idempotent -- without it they were
// skipped by the subscription sync entirely.
export function fallbackUid(ev) {
  const stamp = ev?.date instanceof Date && !Number.isNaN(ev.date.getTime())
    ? ev.date.toISOString()
    : '';
  return `nouid-${stableHash(`${ev?.title || ''} ${stamp}`)}`;
}

// Give every feed event a UID, so nothing is silently dropped downstream.
export function withStableUids(events) {
  return (events || []).map((ev) => (ev && ev.uid ? ev : { ...ev, uid: fallbackUid(ev) }));
}

// Collapse a feed to one event per UID.
//
// iOS/iCloud feeds repeat the UID of a recurring series for every modified
// occurrence (a VEVENT carrying RECURRENCE-ID). Those are edits of a single
// occurrence, not separate entries -- without this every override became its
// own calendar event on top of the series master.
export function dedupeFeedEvents(events) {
  const byUid = new Map();
  for (const ev of events || []) {
    if (!ev || !ev.uid) continue;
    const prev = byUid.get(ev.uid);
    if (!prev) {
      byUid.set(ev.uid, ev);
      continue;
    }
    // The VEVENT without RECURRENCE-ID is the series master; prefer it.
    if (prev.recurrenceId && !ev.recurrenceId) byUid.set(ev.uid, ev);
  }
  return [...byUid.values()];
}

// Feed events we are willing to store: they need a date, and anything older
// than `cutoff` is dropped unless it is a recurring master (whose future
// occurrences are still relevant). Long-running feeds otherwise pile up years
// of dead history, which is what made the calendar slow to load.
export function selectSyncableEvents(events, cutoff) {
  return (events || []).filter((ev) => {
    if (!(ev?.date instanceof Date) || Number.isNaN(ev.date.getTime())) return false;
    if (cutoff && ev.date < cutoff && !ev.recurrence) return false;
    return true;
  });
}

// Compare two feed URLs for "is this the same calendar?".
//
// webcal:// and https:// address the same iCloud/Google feed, and a trailing
// slash or a differently-cased host does not make it a different calendar.
// Subscribing to one feed twice would give every event two independent owners
// and show the whole calendar twice with nothing looking broken.
export function normalizeFeedUrl(url) {
  const raw = String(url || '')
    .trim()
    .replace(/^webcal:\/\//i, 'https://')
    .replace(/^http:\/\//i, 'https://');
  try {
    const parsed = new URL(raw);
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host}${path}${parsed.search}`;
  } catch {
    return raw.replace(/\/+$/, '');
  }
}

// Fingerprint of what a feed actually *says*, ignoring how it says it.
//
// Providers regenerate the .ics on every request -- iCloud rewrites DTSTAMP and
// re-orders entries -- so hashing the raw body would report a change every time
// and defeat the whole point. Hashing the parsed, sorted events means a sync
// can tell "nothing to do" without reading a single document.
export function feedFingerprint(events) {
  const lines = (events || []).map((ev) => [
    ev.uid || '',
    ev.title || '',
    ev.description || '',
    ev.date instanceof Date && !Number.isNaN(ev.date.getTime()) ? ev.date.getTime() : '',
    ev.recurrence
      ? `${ev.recurrence.freq}:${ev.recurrence.interval || 1}:${ev.recurrence.until || ''}`
      : '',
  ].join('\u0001'));
  lines.sort();
  return stableHash(lines.join('\u0002'));
}

// Milliseconds since the epoch for whatever shape a stored date arrives in: a
// Firestore Timestamp from a raw document, or a JS Date from a mapped one.
function timeOf(value) {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'number') return value;
  return NaN;
}

function sameRecurrence(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.freq === b.freq
    && (Number(a.interval) || 1) === (Number(b.interval) || 1)
    && (a.until || null) === (b.until || null);
}

// Does this feed event differ from what is already stored?
//
// The sync used to rewrite every event of the feed on every run, whether or not
// anything had changed -- a thousand-event calendar burned a thousand Firestore
// writes per sync. Feeds change by a handful of events at a time, so comparing
// first turns a routine re-sync into (almost) no writes at all.
export function needsUpdate(stored, ev, subscriptionId) {
  if (!stored) return true;
  if ((stored.title || '') !== (ev.title || 'Untitled')) return true;
  if ((stored.description || '') !== (ev.description || '')) return true;
  if (timeOf(stored.date) !== timeOf(ev.date)) return true;
  if (!sameRecurrence(stored.recurrence, ev.recurrence)) return true;
  // Ownership fields, which also flip when an imported or stranded document is
  // adopted by this subscription.
  if (stored.source !== 'subscription') return true;
  if (stored.subscriptionId !== subscriptionId) return true;
  if (stored.externalId !== ev.uid) return true;
  return false;
}

// An event left behind by a subscription that no longer exists.
//
// Removing a subscription deleted the family-document entry before deleting the
// events, so any failure in between (the delete used to exceed Firestore's
// 500-operation batch cap on a large calendar) stranded the whole feed: nothing
// owned those events any more, no later sync recognised them, and re-adding the
// calendar simply created a second full copy next to them.
export function isOrphanedSubscriptionEvent(data, liveSubscriptionIds) {
  if (!data || data.source !== 'subscription') return false;
  if (!data.subscriptionId) return true;
  return !liveSubscriptionIds.has(data.subscriptionId);
}

// Sort the family's existing event documents into the three groups a sync
// cares about. `entries` are `{ id, ref, data }` wrappers so this stays
// independent of the Firestore SDK.
//
//   owned     - already tagged with the subscription being synced, keyed by UID
//               (a list per UID: anything past the first is a duplicate)
//   adoptable - same UID, but from a file import or a dead subscription; taken
//               over instead of creating a second copy
//   orphans   - every event of a dead subscription, whether or not the feed
//               still lists it; the ones the feed does not claim get deleted
export function classifyExistingEvents({ entries, subscriptionId, liveSubscriptionIds }) {
  const owned = new Map();
  const adoptable = new Map();
  const orphans = [];
  const push = (map, uid, entry) => {
    const list = map.get(uid);
    if (list) list.push(entry);
    else map.set(uid, [entry]);
  };

  for (const entry of entries || []) {
    const data = entry?.data || {};
    const uid = data.externalId;
    if (data.subscriptionId === subscriptionId) {
      if (uid) push(owned, uid, entry);
      continue;
    }
    if (isOrphanedSubscriptionEvent(data, liveSubscriptionIds)) {
      orphans.push(entry);
      if (uid) push(adoptable, uid, entry);
      continue;
    }
    if (!data.subscriptionId && data.source === 'import' && uid) {
      push(adoptable, uid, entry);
    }
  }
  return { owned, adoptable, orphans };
}

// Pick the document a feed event should be written to, and list the leftovers
// that have to go.
//
// `owned` are documents already tagged with this subscription, `adoptable` are
// documents with the same UID that came from a one-time .ics file import of the
// same calendar. Adopting those means subscribing to a calendar you previously
// imported by file updates the existing entries instead of doubling them.
export function pickCanonicalDoc(canonicalId, owned = [], adoptable = []) {
  const candidates = [...owned, ...adoptable];
  if (candidates.length === 0) return { keep: null, drop: [] };
  const exact = owned.find((d) => d.id === canonicalId)
    || adoptable.find((d) => d.id === canonicalId);
  const keep = exact || candidates[0];
  return { keep, drop: candidates.filter((d) => d !== keep) };
}
