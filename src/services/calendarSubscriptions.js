import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { parseICS } from '../utils/icsParser';
import { isDemoMode } from '../lib/demoMode';
import { demoAdd, demoDocs, demoUpdate } from './demoStore';

const eventsRef = collection(db, 'events');

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

// How long a claimed sync is assumed to be running. Short, because the only cost
// of it expiring early is a second device syncing too — while a long lease left
// by a closed tab would block syncing for that whole time.
export const SYNC_LEASE_MS = 5 * 60 * 1000;

/**
 * Claim the right to sync one subscription.
 *
 * Every member's browser tries to re-sync stale subscriptions when the app opens
 * (see AppShell). Without a lease, three members opening the app in the same hour
 * each ran a full sync of every subscription: three ICS fetches, three reads of
 * the family's events, three write batches, racing on the same documents. On the
 * free tier that is also a quota problem — 500 events × 3 members × 24 hourly
 * syncs is ~36k reads a day for one family, against a 50k ceiling.
 *
 * Modelled on the daily-lock transaction in Kaydo's useAnniversaryReminder, but
 * per subscription rather than per family per day: this code already wants hourly
 * freshness, so a daily lock would be a regression.
 *
 * The read and the write are one transaction, which is the whole point — two
 * devices checking an unlocked lease at the same time must not both win.
 *
 * @returns {Promise<boolean>} true when the caller may proceed
 */
export async function claimSyncLease(familyId, subId, now = Date.now()) {
  const famRef = doc(db, 'families', familyId);
  let won = false;
  await runTransaction(db, async (tx) => {
    won = false;
    const snap = await tx.get(famRef);
    if (!snap.exists()) return;

    const list = snap.data()?.calendarSubscriptions || [];
    const target = list.find((s) => s && s.id === subId);
    if (!target) return;

    const heldUntil = target.syncLeaseUntil ? new Date(target.syncLeaseUntil).getTime() : 0;
    // A lease from a tab that was closed mid-sync expires on its own.
    if (heldUntil > now) return;

    tx.update(famRef, {
      calendarSubscriptions: list.map((s) =>
        s && s.id === subId
          ? { ...s, syncLeaseUntil: new Date(now + SYNC_LEASE_MS).toISOString() }
          : s,
      ),
    });
    won = true;
  });
  return won;
}

/**
 * Give the lease back, so another device can sync before it would have expired.
 *
 * Optimistic on purpose: updateSubscriptionMeta does a read-modify-write of the
 * whole array and is racy, which is fine for release — losing this write only
 * means waiting out the lease — but is exactly why claiming uses a transaction.
 */
export async function releaseSyncLease(familyId, subId, patch = {}) {
  return updateSubscriptionMeta(familyId, subId, { ...patch, syncLeaseUntil: null });
}

export async function removeSubscription(familyId, subId) {
  const famRef = doc(db, 'families', familyId);
  const snap = await getDoc(famRef);
  const list = (snap.data()?.calendarSubscriptions || []).filter(
    (s) => s && s.id !== subId,
  );
  await updateDoc(famRef, { calendarSubscriptions: list });

  // Remove all events tied to this subscription. Asked for by subscription
  // rather than reading every event the family has ever had and filtering here
  // — see the composite index in firestore.indexes.json.
  const q = query(
    eventsRef,
    where('familyId', '==', familyId),
    where('subscriptionId', '==', subId),
  );
  const targets = (await getDocs(q)).docs;
  if (targets.length === 0) return;
  const batch = writeBatch(db);
  targets.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// Sync a subscription: fetch the remote ICS, diff against existing synced
// events for this subscription, upsert by UID, delete stale ones.
export async function syncSubscription({ familyId, userId, subscription }) {
  if (isDemoMode()) throw new Error('Calendar subscriptions are disabled in the demo.');
  const { events: remoteEvents } = await fetchRemoteICS(subscription.url);

  // Scoped to this subscription. This is the read that runs hourly per family,
  // so it is the one that matters for the free-tier quota.
  const q = query(
    eventsRef,
    where('familyId', '==', familyId),
    where('subscriptionId', '==', subscription.id),
  );
  const existing = (await getDocs(q)).docs;
  const byUid = new Map();
  existing.forEach((d) => {
    const uid = d.data().externalId;
    if (uid) byUid.set(uid, d);
  });

  const seen = new Set();
  // A committed WriteBatch cannot be reused, so every flush starts a fresh one.
  let batch = writeBatch(db);
  let writes = 0;

  for (const ev of remoteEvents) {
    if (!ev.uid || !ev.date) continue;
    seen.add(ev.uid);
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
      source: 'subscription',
      subscriptionId: subscription.id,
      externalId: ev.uid,
      updatedAt: serverTimestamp(),
    };

    const known = byUid.get(ev.uid);
    if (known) {
      // userId is deliberately left out of the update. It is set once, when the
      // mirror is created, because the events create rule requires it to be the
      // caller. Rewriting it on every sync handed ownership of every mirrored
      // event to whichever member happened to hold the lease that hour, and
      // nothing reads the field anyway.
      const { userId: _ownedByCreator, ...mutable } = payload;
      batch.update(known.ref, mutable);
    } else {
      const newRef = doc(eventsRef);
      batch.set(newRef, { ...payload, createdAt: serverTimestamp() });
    }
    writes += 1;
    // Firestore caps batches at 500 ops; flush early if needed.
    if (writes >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      writes = 0;
    }
  }

  // Delete events that disappeared from the remote feed.
  for (const [uid, snap] of byUid.entries()) {
    if (!seen.has(uid)) {
      batch.delete(snap.ref);
      writes += 1;
      if (writes >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        writes = 0;
      }
    }
  }
  if (writes > 0) await batch.commit();

  // One write, not two: the lease is released here rather than by the caller, so
  // a successful sync does not do updateSubscriptionMeta's read-modify-write
  // twice over and cannot race itself.
  await updateSubscriptionMeta(familyId, subscription.id, {
    lastSyncAt: new Date().toISOString(),
    lastError: null,
    syncLeaseUntil: null,
  });

  return { count: remoteEvents.length };
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

  const candidates = parsed.events.filter((e) => {
    if (!e.date) return false;
    if (skipPast && e.date < todayStart && !e.recurrence) return false;
    return true;
  });

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
