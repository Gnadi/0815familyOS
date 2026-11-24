import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isDemoMode } from '../lib/demoMode';
import { demoAdd, demoBatch, demoDelete, demoDocs, demoSubscribe, demoUpdate } from './demoStore';

// Two collections: `trackers` holds the definitions a family sets up once
// ("Vitamin D", "Medicine", "Threw up"), `trackerEntries` holds one document
// per logged moment. Splitting them keeps a tracker's history unbounded
// without ever rewriting the definition document.
const trackersRef = collection(db, 'trackers');
const entriesRef = collection(db, 'trackerEntries');

const nowVal = () => (isDemoMode() ? new Date() : serverTimestamp());
const dateVal = (date) => (isDemoMode() ? date : Timestamp.fromDate(date));

function toDate(value) {
  if (!value) return null;
  return value?.toDate ? value.toDate() : value;
}

// Coerces the form's free-text numbers into a stored number or null. Empty,
// negative and non-numeric input all collapse to null so a bad keystroke can
// never write NaN into Firestore.
function positiveNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeTracker(id, data) {
  return {
    id,
    ...data,
    // Older documents (and hand-written ones) may carry a single kidId.
    kidIds: Array.isArray(data.kidIds) ? data.kidIds : data.kidId ? [data.kidId] : [],
    trackValue: Boolean(data.trackValue),
    dailyGoal: data.dailyGoal ?? null,
    minIntervalHours: data.minIntervalHours ?? null,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function mapTrackerDocs(docs) {
  return docs
    .map((d) => normalizeTracker(d.id, d.data()))
    .sort((a, b) => {
      const oa = a.order ?? 0;
      const ob = b.order ?? 0;
      if (oa !== ob) return oa - ob;
      return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
    });
}

function mapEntryDocs(docs) {
  return docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        at: toDate(data.at),
        createdAt: toDate(data.createdAt),
      };
    })
    .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));
}

// Both subscriptions filter on familyId only and sort client-side, matching the
// rest of the app: a single-field query needs no composite Firestore index.
export function subscribeTrackers(familyId, cb, onError) {
  if (isDemoMode()) return demoSubscribe('trackers', (docs) => cb(mapTrackerDocs(docs)));
  const q = query(trackersRef, where('familyId', '==', familyId));
  return onSnapshot(q, (snap) => cb(mapTrackerDocs(snap.docs)), onError);
}

export function subscribeTrackerEntries(familyId, cb, onError) {
  if (isDemoMode()) return demoSubscribe('trackerEntries', (docs) => cb(mapEntryDocs(docs)));
  const q = query(entriesRef, where('familyId', '==', familyId));
  return onSnapshot(q, (snap) => cb(mapEntryDocs(snap.docs)), onError);
}

export function trackerPayload({ name, emoji, color, kidIds, unit, trackValue, dailyGoal, minIntervalHours }) {
  return {
    name: name.trim(),
    emoji: emoji || '⭐',
    color: color || 'brand',
    kidIds: [...new Set(kidIds || [])],
    unit: (unit || '').trim(),
    trackValue: Boolean(trackValue),
    dailyGoal: positiveNumberOrNull(dailyGoal),
    minIntervalHours: positiveNumberOrNull(minIntervalHours),
  };
}

export function createTracker({ familyId, userId, order, ...values }) {
  const payload = {
    familyId,
    userId,
    ...trackerPayload(values),
    order: order ?? Date.now(),
    createdAt: nowVal(),
    updatedAt: nowVal(),
  };
  if (isDemoMode()) return demoAdd('trackers', payload);
  return addDoc(trackersRef, payload);
}

export function updateTracker(id, values) {
  const payload = { ...trackerPayload(values), updatedAt: nowVal() };
  if (isDemoMode()) return demoUpdate('trackers', id, payload);
  return updateDoc(doc(db, 'trackers', id), payload);
}

// Deleting a tracker takes its history with it — an orphaned entry would be
// invisible in the UI but still counted by the export and the family's quota.
export async function deleteTracker(id, familyId) {
  const orphans = await entriesForTracker(id, familyId);
  if (isDemoMode()) {
    await demoBatch(async () => {
      await Promise.all(orphans.map((entryId) => demoDelete('trackerEntries', entryId)));
    });
    return demoDelete('trackers', id);
  }
  // Firestore caps a batch at 500 writes, so chunk rather than assume.
  for (let i = 0; i < orphans.length; i += 400) {
    const batch = writeBatch(db);
    for (const entryId of orphans.slice(i, i + 400)) {
      batch.delete(doc(db, 'trackerEntries', entryId));
    }
    await batch.commit();
  }
  return deleteDoc(doc(db, 'trackers', id));
}

// Entries logged on or after `since`. The Dashboard's tracker cards need only
// "today" and "the last time" per child; the full log stays with the Tracker
// page. Needs the composite index (familyId, at).
export function subscribeRecentTrackerEntries(familyId, since, cb, onError) {
  if (isDemoMode()) {
    return demoSubscribe('trackerEntries', (docs) => cb(
      mapEntryDocs(docs).filter((e) => e.at && e.at >= since),
    ));
  }
  const q = query(
    entriesRef,
    where('familyId', '==', familyId),
    where('at', '>=', Timestamp.fromDate(since)),
  );
  return onSnapshot(q, (snap) => cb(mapEntryDocs(snap.docs)), onError);
}

// The newest entry of one tracker for one child, or null. Used for the cards
// whose last entry is older than the recent window ("last given 3 weeks
// ago"). Needs the composite index (familyId, trackerId, kidId, at desc).
export async function fetchLatestTrackerEntry(familyId, trackerId, kidId) {
  if (isDemoMode()) {
    return mapEntryDocs(demoDocs('trackerEntries'))
      .find((e) => e.trackerId === trackerId && e.kidId === kidId) || null;
  }
  const snap = await getDocs(query(
    entriesRef,
    where('familyId', '==', familyId),
    where('trackerId', '==', trackerId),
    where('kidId', '==', kidId),
    orderBy('at', 'desc'),
    limit(1),
  ));
  return mapEntryDocs(snap.docs)[0] || null;
}

async function entriesForTracker(trackerId, familyId) {
  if (isDemoMode()) {
    return demoDocs('trackerEntries')
      .filter((d) => d.data().trackerId === trackerId)
      .map((d) => d.id);
  }
  // Equality filters only, so Firestore merges its single-field indexes and no
  // composite index is needed. familyId stays in the query for the rules.
  const snap = await getDocs(query(
    entriesRef,
    where('familyId', '==', familyId),
    where('trackerId', '==', trackerId),
  ));
  return snap.docs.map((d) => d.id);
}

export function logTrackerEntry({ familyId, userId, trackerId, kidId, at, value, note }) {
  const when = at instanceof Date ? at : new Date();
  const payload = {
    familyId,
    userId,
    trackerId,
    kidId,
    at: dateVal(when),
    value: numberOrNull(value),
    note: (note || '').trim(),
    createdAt: nowVal(),
  };
  if (isDemoMode()) return demoAdd('trackerEntries', payload);
  return addDoc(entriesRef, payload);
}

export function updateTrackerEntry(id, { at, value, note }) {
  const when = at instanceof Date ? at : new Date();
  const payload = {
    at: dateVal(when),
    value: numberOrNull(value),
    note: (note || '').trim(),
  };
  if (isDemoMode()) return demoUpdate('trackerEntries', id, payload);
  return updateDoc(doc(db, 'trackerEntries', id), payload);
}

export function deleteTrackerEntry(id) {
  if (isDemoMode()) return demoDelete('trackerEntries', id);
  return deleteDoc(doc(db, 'trackerEntries', id));
}
