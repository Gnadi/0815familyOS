import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CATEGORIES, DEFAULT_CATEGORY } from '../constants/eventCategories';

const eventsRef = collection(db, 'events');

function normalizeCategory(category) {
  return category && CATEGORIES[category] ? category : DEFAULT_CATEGORY;
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
