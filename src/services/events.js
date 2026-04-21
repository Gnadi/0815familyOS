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

const eventsRef = collection(db, 'events');

function normalizeCategory(category) {
  return typeof category === 'string' && category.trim() ? category : DEFAULT_CATEGORY;
}

export function subscribeEvents(familyId, cb) {
  const q = query(eventsRef, where('familyId', '==', familyId), orderBy('date', 'asc'));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        category: normalizeCategory(data.category),
        date: data.date?.toDate ? data.date.toDate() : data.date,
      };
    });
    cb(list);
  });
}

export function createEvent({ familyId, userId, title, description, date, category }) {
  return addDoc(eventsRef, {
    familyId,
    userId,
    title: title.trim(),
    description: description?.trim() || '',
    category: normalizeCategory(category),
    date: Timestamp.fromDate(date),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateEvent(id, { title, description, date, category }) {
  return updateDoc(doc(db, 'events', id), {
    title: title.trim(),
    description: description?.trim() || '',
    category: normalizeCategory(category),
    date: Timestamp.fromDate(date),
    updatedAt: serverTimestamp(),
  });
}

export function deleteEvent(id) {
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
