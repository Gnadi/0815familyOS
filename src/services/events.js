import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
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
import { DEFAULT_CATEGORY } from '../constants/eventCategories';
import { isDemoMode } from '../lib/demoMode';
import { demoAdd, demoDelete, demoDocs, demoSubscribe, demoUpdate } from './demoStore';

const eventsRef = collection(db, 'events');

// In demo mode payloads carry plain JS Dates (the demo store never sees
// Firestore sentinels); otherwise the usual Timestamp/serverTimestamp values.
const nowVal = () => (isDemoMode() ? new Date() : serverTimestamp());
const dateVal = (d) => (isDemoMode() ? d : Timestamp.fromDate(d));

function normalizeCategory(category) {
  return typeof category === 'string' && category.trim() ? category : DEFAULT_CATEGORY;
}

function normalizeRecurrence(rec) {
  if (!rec || !rec.freq) return null;
  const freq = ['daily', 'weekly', 'monthly', 'yearly'].includes(rec.freq) ? rec.freq : null;
  if (!freq) return null;
  const interval = Math.max(1, Math.min(99, Math.round(Number(rec.interval) || 1)));
  const until = rec.until ? String(rec.until) : null;
  return { freq, interval, until };
}

function mapEventDoc(d) {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    category: normalizeCategory(data.category),
    date: data.date?.toDate ? data.date.toDate() : data.date,
    kids: data.kids || [],
    responsibleParent: data.responsibleParent || '',
    effortLevel: data.effortLevel || '',
    recurrence: normalizeRecurrence(data.recurrence),
  };
}

function mapEventDocs(docs) {
  return docs
    .map(mapEventDoc)
    .sort((a, b) => (a.date?.getTime?.() || 0) - (b.date?.getTime?.() || 0));
}

export function subscribeEvents(familyId, cb) {
  if (isDemoMode()) return demoSubscribe('events', (docs) => cb(mapEventDocs(docs)));
  const q = query(eventsRef, where('familyId', '==', familyId), orderBy('date', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map(mapEventDoc));
  });
}

// One-shot fetch for flows that don't need a live listener (e.g. the
// Settings .ics export).
export async function fetchEventsOnce(familyId) {
  if (isDemoMode()) return mapEventDocs(demoDocs('events'));
  const q = query(eventsRef, where('familyId', '==', familyId), orderBy('date', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(mapEventDoc);
}

export function createEvent({ familyId, userId, title, description, date, category, kids, responsibleParent, effortLevel, recurrence }) {
  const payload = {
    familyId,
    userId,
    title: title.trim(),
    description: description?.trim() || '',
    category: normalizeCategory(category),
    date: dateVal(date),
    kids: kids || [],
    responsibleParent: responsibleParent || '',
    effortLevel: effortLevel || '',
    recurrence: normalizeRecurrence(recurrence),
    createdAt: nowVal(),
    updatedAt: nowVal(),
  };
  if (isDemoMode()) return demoAdd('events', payload);
  return addDoc(eventsRef, payload);
}

export function updateEvent(id, { title, description, date, category, kids, responsibleParent, effortLevel, recurrence }) {
  const payload = {
    title: title.trim(),
    description: description?.trim() || '',
    category: normalizeCategory(category),
    date: dateVal(date),
    kids: kids || [],
    responsibleParent: responsibleParent || '',
    effortLevel: effortLevel || '',
    recurrence: normalizeRecurrence(recurrence),
    updatedAt: nowVal(),
  };
  if (isDemoMode()) return demoUpdate('events', id, payload);
  return updateDoc(doc(db, 'events', id), payload);
}

export function deleteEvent(id) {
  if (isDemoMode()) return demoDelete('events', id);
  return deleteDoc(doc(db, 'events', id));
}

// Reassign every event in `familyId` whose category equals `fromCategoryId`
// to `toCategoryId`. Filtered client-side so we only need the single-field
// `familyId` index (Firestore builds that automatically).
export async function reassignEventsCategory(
  familyId,
  fromCategoryId,
  toCategoryId = DEFAULT_CATEGORY
) {
  if (isDemoMode()) {
    const targets = demoDocs('events').filter((d) => d.data().category === fromCategoryId);
    for (const d of targets) {
      await demoUpdate('events', d.id, { category: toCategoryId, updatedAt: new Date() });
    }
    return targets.length;
  }
  const q = query(eventsRef, where('familyId', '==', familyId));
  const snap = await getDocs(q);
  const targets = snap.docs.filter((d) => d.data().category === fromCategoryId);
  if (targets.length === 0) return 0;
  const batch = writeBatch(db);
  targets.forEach((d) =>
    batch.update(d.ref, { category: toCategoryId, updatedAt: serverTimestamp() })
  );
  await batch.commit();
  return targets.length;
}
