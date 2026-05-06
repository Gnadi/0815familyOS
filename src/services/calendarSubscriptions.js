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

// Sync a subscription: fetch the remote ICS, diff against existing synced
// events for this subscription, upsert by UID, delete stale ones.
export async function syncSubscription({ familyId, userId, subscription }) {
  const { events: remoteEvents } = await fetchRemoteICS(subscription.url);

  const q = query(eventsRef, where('familyId', '==', familyId));
  const allSnap = await getDocs(q);
  const existing = allSnap.docs.filter(
    (d) => d.data().subscriptionId === subscription.id,
  );
  const byUid = new Map();
  existing.forEach((d) => {
    const uid = d.data().externalId;
    if (uid) byUid.set(uid, d);
  });

  const seen = new Set();
  const batch = writeBatch(db);
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
      batch.update(known.ref, payload);
    } else {
      const newRef = doc(eventsRef);
      batch.set(newRef, { ...payload, createdAt: serverTimestamp() });
    }
    writes += 1;
    // Firestore caps batches at 500 ops; flush early if needed.
    if (writes >= 400) {
      await batch.commit();
      writes = 0;
    }
  }

  // Delete events that disappeared from the remote feed.
  for (const [uid, snap] of byUid.entries()) {
    if (!seen.has(uid)) {
      batch.delete(snap.ref);
      writes += 1;
    }
  }
  if (writes > 0) await batch.commit();

  await updateSubscriptionMeta(familyId, subscription.id, {
    lastSyncAt: new Date().toISOString(),
    lastError: null,
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

  // Look up existing imports to dedupe by UID.
  const q = query(eventsRef, where('familyId', '==', familyId));
  const allSnap = await getDocs(q);
  const byUid = new Map();
  allSnap.docs.forEach((d) => {
    const uid = d.data().externalId;
    if (uid) byUid.set(uid, d);
  });

  const batch = writeBatch(db);
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
      writes = 0;
    }
  }
  if (writes > 0) await batch.commit();

  return { created, updated, skipped: parsed.events.length - candidates.length };
}
