// Helpers for subscribed calendars. Deliberately free of Firebase imports so
// they stay unit-testable, and shared between the feeds computed on the fly and
// the one-time .ics file import.

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

// Identity of a feed event that is never stored in Firestore.
//
// Subscribed calendars are computed on the fly from the .ics feed rather than
// mirrored into the database, so these ids exist only in memory. The "feed:"
// prefix keeps them apart from real document ids at a glance.
export function virtualEventId(subscriptionId, uid) {
  return `feed:${subscriptionId}:${stableHash(uid)}`;
}

export function isFeedEvent(ev) {
  return typeof ev?.id === 'string' && ev.id.startsWith('feed:');
}

// Document id for the annotation overlay of one feed event.
//
// A feed owns the title, time and description; the family owns who is
// responsible, which kids are involved, the effort and the category. Those
// annotations are the only thing worth persisting, and only for the handful of
// events anyone actually annotates.
export function annotationDocId(subscriptionId, externalId) {
  return `ann_${slug(subscriptionId, 32)}_${stableHash(`${subscriptionId} ${externalId}`)}`;
}

const ANNOTATION_FIELDS = ['category', 'kids', 'responsibleParent', 'effortLevel'];

// Is there anything in this annotation worth keeping?
export function hasAnnotation(values) {
  if (!values) return false;
  if (values.kids?.length) return true;
  if (values.responsibleParent) return true;
  if (values.effortLevel) return true;
  if (values.category && values.category !== 'general') return true;
  return false;
}

// Overlay stored annotations onto the events computed from the feeds.
export function applyAnnotations(feedEvents, annotations) {
  if (!annotations?.size) return feedEvents;
  return feedEvents.map((ev) => {
    const overlay = annotations.get(`${ev.subscriptionId}\u0000${ev.externalId}`);
    if (!overlay) return ev;
    const merged = { ...ev };
    for (const field of ANNOTATION_FIELDS) {
      if (overlay[field] !== undefined && overlay[field] !== null) merged[field] = overlay[field];
    }
    return merged;
  });
}

// Index annotation documents by the feed event they belong to.
export function indexAnnotations(docs) {
  const byKey = new Map();
  for (const d of docs || []) {
    if (d?.source !== 'annotation' || !d.subscriptionId || !d.externalId) continue;
    byKey.set(`${d.subscriptionId}\u0000${d.externalId}`, d);
  }
  return byKey;
}

// An event left behind by a subscription that no longer exists.
//
// Removing a subscription deleted the family-document entry before deleting the
// events, so any failure in between (the delete used to exceed Firestore's
// 500-operation batch cap on a large calendar) stranded the whole feed: nothing
// owned those events any more, no later sync recognised them, and re-adding the
// calendar simply created a second full copy next to them.
export function isOrphanedSubscriptionEvent(data, liveSubscriptionIds) {
  // 'subscription' is the retired mirrored copy of a feed event; 'annotation'
  // is the overlay that replaced it. Both belong to a subscription and both are
  // meaningless once it is gone.
  if (!data || (data.source !== 'subscription' && data.source !== 'annotation')) return false;
  if (!data.subscriptionId) return true;
  return !liveSubscriptionIds.has(data.subscriptionId);
}
