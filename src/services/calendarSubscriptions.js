import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  annotationDocId,
  dedupeFeedEvents,
  hasAnnotation,
  isOrphanedSubscriptionEvent,
  normalizeFeedUrl,
  selectSyncableEvents,
  withStableUids,
} from '../utils/calendarSync';
import { clearFeedCache } from './calendarFeeds';
import { isDemoMode } from '../lib/demoMode';
import { demoAdd, demoDocs, demoUpdate } from './demoStore';

const eventsRef = collection(db, 'events');

// Firestore caps a WriteBatch at 500 operations.
const BATCH_LIMIT = 400;

function genId() {
  return `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function addSubscription(familyId, { label, url }) {
  // URL subscriptions need the server-side ICS proxy and periodic re-syncs —
  // out of scope for the offline demo. The one-time file import still works.
  if (isDemoMode()) throw new Error('Calendar subscriptions are disabled in the demo.');
  const trimmedUrl = String(url || '').trim();
  if (!trimmedUrl) throw new Error('URL is required.');

  // Subscribing to the same feed twice gives every event two owners, and each
  // subscription legitimately keeps its own copy -- so the calendar shows
  // everything twice with nothing obviously wrong. Refuse the second one.
  const famSnap = await getDoc(doc(db, 'families', familyId));
  const already = (famSnap.data()?.calendarSubscriptions || []).some(
    (s) => normalizeFeedUrl(s?.url) === normalizeFeedUrl(trimmedUrl),
  );
  if (already) {
    const err = new Error('This calendar is already subscribed.');
    err.code = 'duplicate-subscription';
    throw err;
  }

  const sub = {
    id: genId(),
    label: String(label || '').trim() || 'External Calendar',
    url: trimmedUrl,
    addedAt: new Date().toISOString(),
    lastSyncAt: null,
    lastError: null,
  };
  await updateDoc(doc(db, 'families', familyId), {
    calendarSubscriptions: arrayUnion(sub),
  });
  return sub;
}

export async function updateSubscriptionMeta(familyId, subId, patch) {
  const famRef = doc(db, 'families', familyId);
  const snap = await getDoc(famRef);
  const list = (snap.data()?.calendarSubscriptions || []).map((s) =>
    s && s.id === subId ? { ...s, ...patch } : s,
  );
  await updateDoc(famRef, { calendarSubscriptions: list });
}

// Delete document references in batches Firestore will actually accept.
//
// A WriteBatch is capped at 500 operations. Deleting a whole subscription in
// one batch therefore threw on any calendar with more than 500 events -- and
// since the subscription had already been removed from the family document by
// then, the events were stranded with no owner.
async function deleteRefsInChunks(refs) {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(i, i + BATCH_LIMIT)) batch.delete(ref);
    // eslint-disable-next-line no-await-in-loop -- batches must commit in order
    await batch.commit();
  }
}

function liveSubscriptionIdsOf(familySnap) {
  return new Set(
    (familySnap.data()?.calendarSubscriptions || [])
      .map((s) => s?.id)
      .filter(Boolean),
  );
}

// Read the family document straight from the server, never from the offline
// cache. Deciding that a subscription is dead is a decision to delete events,
// and a stale cached copy would not yet know about a subscription another
// family member just added. Returns null when the server cannot be reached --
// callers must then leave the orphan handling alone.
async function readLiveFamily(familyId) {
  try {
    const snap = await getDocFromServer(doc(db, 'families', familyId));
    return snap.exists() ? snap : null;
  } catch {
    return null;
  }
}

export async function removeSubscription(familyId, subId, { existingEvents } = {}) {
  const famRef = doc(db, 'families', familyId);

  // Nothing of the calendar itself is stored, so removing it is just dropping
  // the family-document entry plus whatever annotations were attached to it.
  // Annotations first: if that fails the subscription stays, and the user can
  // retry rather than being left with overlays nothing owns.
  const entries = await loadEventEntries(familyId, existingEvents);
  const targets = entries.filter(
    (e) => e.data?.source === 'annotation' && e.data.subscriptionId === subId,
  );
  await deleteRefsInChunks(targets.map((e) => e.ref));

  const snap = await getDoc(famRef);
  const list = (snap.data()?.calendarSubscriptions || []).filter(
    (s) => s && s.id !== subId,
  );
  await updateDoc(famRef, { calendarSubscriptions: list });

  clearFeedCache(subId);
  return { removed: targets.length };
}

// Delete annotations left behind by subscriptions that no longer exist.
export async function cleanupOrphanedSubscriptionEvents(familyId, { existingEvents } = {}) {
  if (isDemoMode()) return { removed: 0 };

  if (Array.isArray(existingEvents)
    && !existingEvents.some((ev) => ev?.source === 'annotation' || ev?.source === 'subscription')) {
    return { removed: 0 };
  }

  // Without a confirmed server-side view of the subscription list we cannot
  // tell which subscriptions are live, and guessing would wipe real data.
  const famSnap = await readLiveFamily(familyId);
  if (!famSnap) return { removed: 0 };
  const live = liveSubscriptionIdsOf(famSnap);

  const entries = await loadEventEntries(familyId, existingEvents);
  const orphans = entries.filter((e) => isOrphanedSubscriptionEvent(e.data, live));
  if (orphans.length === 0) return { removed: 0 };
  await deleteRefsInChunks(orphans.map((e) => e.ref));
  return { removed: orphans.length };
}

// The family's events, preferably from the live listener the app is already
// running. That listener has paid the Firestore reads once; re-querying the
// whole collection pays for all of them again. Falls back to a real query when
// nothing is listening.
async function loadEventEntries(familyId, existingEvents) {
  if (Array.isArray(existingEvents)) {
    return existingEvents.map((ev) => ({
      id: ev.id,
      ref: doc(db, 'events', ev.id),
      data: ev,
    }));
  }
  const allSnap = await getDocs(query(eventsRef, where('familyId', '==', familyId)));
  return allSnap.docs.map((d) => ({ id: d.id, ref: d.ref, data: d.data() }));
}

// Retire the mirrored copies of subscribed calendars.
//
// Subscriptions used to be synced into the events collection: one document per
// feed event, rewritten on every sync. They are now computed from the .ics feed
// on the fly, so those documents are dead weight -- and they were the thing
// that could duplicate, strand and blow the free tier.
//
// Anything the family had annotated (kids, responsible parent, effort, a
// category) is kept: it is rewritten as a small overlay document, which is the
// only part a feed cannot reproduce. Everything else is deleted.
export async function migrateMirroredSubscriptionEvents(familyId, { userId, existingEvents } = {}) {
  if (isDemoMode() || !userId) return { migrated: 0, removed: 0 };

  // Cheap exit: when the app already holds the events, finding nothing to do
  // costs nothing. That is the outcome on every session after the first.
  if (Array.isArray(existingEvents)
    && !existingEvents.some((ev) => ev?.source === 'subscription')) {
    return { migrated: 0, removed: 0 };
  }

  const entries = await loadEventEntries(familyId, existingEvents);
  const mirrored = entries.filter((e) => e.data?.source === 'subscription');
  if (mirrored.length === 0) return { migrated: 0, removed: 0 };

  const annotated = mirrored.filter((e) => e.data.externalId && hasAnnotation(e.data));

  let batch = writeBatch(db);
  let writes = 0;
  const flushIfFull = async () => {
    writes += 1;
    if (writes >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      writes = 0;
    }
  };

  for (const entry of annotated) {
    const { data } = entry;
    const id = annotationDocId(data.subscriptionId || '', data.externalId);
    batch.set(doc(db, 'events', id), {
      familyId,
      // The events rules require a create to name the caller, so the
      // annotation is authored by whoever runs the migration -- not by
      // whoever the retired mirror happened to be attributed to.
      userId,
      source: 'annotation',
      subscriptionId: data.subscriptionId || '',
      externalId: data.externalId,
      date: data.date,
      category: data.category || 'general',
      kids: data.kids || [],
      responsibleParent: data.responsibleParent || '',
      effortLevel: data.effortLevel || '',
      updatedAt: serverTimestamp(),
    });
    await flushIfFull();
  }
  if (writes > 0) await batch.commit();

  await deleteRefsInChunks(mirrored.map((e) => e.ref));
  return { migrated: annotated.length, removed: mirrored.length };
}

// Bulk-import events from a parsed ICS (one-time file import). Tags events
// with source='import' and externalId=UID so a re-import upserts cleanly.
export async function importEventsFromParsed({
  familyId,
  userId,
  parsed,
  skipPast = true,
}) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Same collapse as the subscription sync: one entry per UID, so a file whose
  // recurring series carries per-occurrence RECURRENCE-ID overrides does not
  // import the same event several times over.
  const feed = dedupeFeedEvents(withStableUids(parsed.events));
  const candidates = selectSyncableEvents(feed, skipPast ? todayStart : null);

  // Demo: same upsert-by-UID semantics against the in-memory store, so the
  // one-time file import stays fully functional offline.
  if (isDemoMode()) {
    const byUid = new Map();
    demoDocs('events').forEach((d) => {
      const uid = d.data().externalId;
      if (uid) byUid.set(uid, d.id);
    });
    let created = 0;
    let updated = 0;
    for (const ev of candidates) {
      const payload = {
        familyId,
        userId,
        title: ev.title || 'Untitled',
        description: ev.description || '',
        category: 'general',
        date: ev.date,
        kids: [],
        responsibleParent: '',
        effortLevel: '',
        recurrence: ev.recurrence || null,
        source: 'import',
        externalId: ev.uid || null,
        updatedAt: new Date(),
      };
      const knownId = ev.uid ? byUid.get(ev.uid) : null;
      if (knownId) {
        await demoUpdate('events', knownId, payload);
        updated += 1;
      } else {
        await demoAdd('events', { ...payload, createdAt: new Date() });
        created += 1;
      }
    }
    return { created, updated, skipped: parsed.events.length - candidates.length };
  }

  // Look up existing imports to dedupe by UID.
  const q = query(eventsRef, where('familyId', '==', familyId));
  const allSnap = await getDocs(q);
  const byUid = new Map();
  allSnap.docs.forEach((d) => {
    const uid = d.data().externalId;
    if (uid) byUid.set(uid, d);
  });

  // A committed WriteBatch cannot be reused, so every flush starts a fresh one.
  let batch = writeBatch(db);
  let writes = 0;
  let created = 0;
  let updated = 0;

  for (const ev of candidates) {
    const payload = {
      familyId,
      userId,
      title: ev.title || 'Untitled',
      description: ev.description || '',
      category: 'general',
      date: Timestamp.fromDate(ev.date),
      kids: [],
      responsibleParent: '',
      effortLevel: '',
      recurrence: ev.recurrence || null,
      source: 'import',
      externalId: ev.uid || null,
      updatedAt: serverTimestamp(),
    };

    const known = ev.uid ? byUid.get(ev.uid) : null;
    if (known) {
      batch.update(known.ref, payload);
      updated += 1;
    } else {
      const ref = doc(eventsRef);
      batch.set(ref, { ...payload, createdAt: serverTimestamp() });
      created += 1;
    }
    writes += 1;
    if (writes >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      writes = 0;
    }
  }
  if (writes > 0) await batch.commit();

  return { created, updated, skipped: parsed.events.length - candidates.length };
}
