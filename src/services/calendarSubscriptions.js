import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { parseICS } from '../utils/icsParser';
import {
  dedupeFeedEvents,
  normalizeFeedUrl,
  pickCanonicalDoc,
  selectSyncableEvents,
  subscriptionEventId,
  withStableUids,
} from '../utils/calendarSync';
import { isDemoMode } from '../lib/demoMode';
import { demoAdd, demoDocs, demoUpdate } from './demoStore';

const eventsRef = collection(db, 'events');

// How far back a subscription mirrors its feed. Past one-off events beyond this
// are not imported, and existing ones are cleaned up on the next sync -- a feed
// with years of history otherwise grows the events collection without bound and
// makes every calendar load slower.
const SYNC_PAST_WINDOW_DAYS = 365;

// Firestore caps a WriteBatch at 500 operations.
const BATCH_LIMIT = 400;

function genId() {
  return `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function fetchRemoteICS(url) {
  const res = await fetch('/api/ics-fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Fetch failed (${res.status}).`);
  }
  const data = await res.json();
  return parseICS(data.ics || '');
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

export async function removeSubscription(familyId, subId) {
  const famRef = doc(db, 'families', familyId);
  const snap = await getDoc(famRef);
  const list = (snap.data()?.calendarSubscriptions || []).filter(
    (s) => s && s.id !== subId,
  );
  await updateDoc(famRef, { calendarSubscriptions: list });

  // Remove all events tied to this subscription.
  const q = query(eventsRef, where('familyId', '==', familyId));
  const all = await getDocs(q);
  const targets = all.docs.filter((d) => d.data().subscriptionId === subId);
  if (targets.length === 0) return;
  const batch = writeBatch(db);
  targets.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// In-flight syncs, keyed by family + subscription.
//
// Adding a subscription used to run two syncs at once: the explicit initial one
// from Settings, and the background one AppShell starts the moment the new
// subscription lands in the family document. Both read the events collection
// before either had written anything, so both concluded "nothing here yet" and
// created a full copy of the feed -- every event twice. Concurrent callers now
// share a single run.
const inFlightSyncs = new Map();

// Sync a subscription: fetch the remote ICS, diff against existing synced
// events for this subscription, upsert by UID, delete stale ones.
export function syncSubscription({ familyId, userId, subscription }) {
  if (isDemoMode()) {
    return Promise.reject(new Error('Calendar subscriptions are disabled in the demo.'));
  }
  const key = `${familyId}:${subscription?.id}`;
  const running = inFlightSyncs.get(key);
  if (running) return running;

  const run = runSync({ familyId, userId, subscription }).finally(() => {
    if (inFlightSyncs.get(key) === run) inFlightSyncs.delete(key);
  });
  inFlightSyncs.set(key, run);
  return run;
}

async function runSync({ familyId, userId, subscription }) {
  const { events: remoteEvents } = await fetchRemoteICS(subscription.url);

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - SYNC_PAST_WINDOW_DAYS);
  const feed = selectSyncableEvents(
    dedupeFeedEvents(withStableUids(remoteEvents)),
    cutoff,
  );

  const q = query(eventsRef, where('familyId', '==', familyId));
  const allSnap = await getDocs(q);

  // Index every candidate document *per UID* rather than keeping only the last
  // one seen. Anything beyond the first copy is a duplicate from an earlier
  // racing sync and gets deleted below, so an already-doubled calendar heals
  // itself on the next sync.
  const ownedByUid = new Map();
  const importedByUid = new Map();
  for (const d of allSnap.docs) {
    const data = d.data();
    const uid = data.externalId;
    if (!uid) continue;
    if (data.subscriptionId === subscription.id) {
      if (!ownedByUid.has(uid)) ownedByUid.set(uid, []);
      ownedByUid.get(uid).push(d);
    } else if (!data.subscriptionId && data.source === 'import') {
      // Same event previously pulled in via the one-time .ics file import.
      if (!importedByUid.has(uid)) importedByUid.set(uid, []);
      importedByUid.get(uid).push(d);
    }
  }

  const seen = new Set();
  // A committed WriteBatch cannot be reused, so every flush starts a fresh one.
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

  for (const ev of feed) {
    seen.add(ev.uid);
    // Fields the feed owns. Everything else on the document (category, kids,
    // responsibleParent, effortLevel) is set once at creation and then left
    // alone, so local edits survive a re-sync.
    const remoteFields = {
      familyId,
      userId,
      title: ev.title || 'Untitled',
      description: ev.description || '',
      date: Timestamp.fromDate(ev.date),
      recurrence: ev.recurrence || null,
      source: 'subscription',
      subscriptionId: subscription.id,
      externalId: ev.uid,
      updatedAt: serverTimestamp(),
    };

    const canonicalId = subscriptionEventId(subscription.id, ev.uid);
    const { keep, drop } = pickCanonicalDoc(
      canonicalId,
      ownedByUid.get(ev.uid) || [],
      importedByUid.get(ev.uid) || [],
    );

    if (keep) {
      batch.update(keep.ref, remoteFields);
    } else {
      // Deterministic id: a concurrent sync writing the same event targets this
      // exact document, so the write is an overwrite instead of a second copy.
      batch.set(doc(db, 'events', canonicalId), {
        ...remoteFields,
        category: 'general',
        kids: [],
        responsibleParent: '',
        effortLevel: '',
        createdAt: serverTimestamp(),
      });
    }
    await flushIfFull();

    for (const dupe of drop) {
      batch.delete(dupe.ref);
      await flushIfFull();
    }
  }

  // Delete events that disappeared from the remote feed (or fell out of the
  // sync window). Only documents owned by this subscription -- file imports are
  // the user's own copy and are left untouched unless the feed claims them.
  for (const [uid, docs] of ownedByUid.entries()) {
    if (seen.has(uid)) continue;
    for (const stale of docs) {
      batch.delete(stale.ref);
      await flushIfFull();
    }
  }
  if (writes > 0) await batch.commit();

  await updateSubscriptionMeta(familyId, subscription.id, {
    lastSyncAt: new Date().toISOString(),
    lastError: null,
  });

  return { count: feed.length };
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
