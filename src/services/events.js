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

const eventsRef = collection(db, 'events');

export function subscribeEvents(familyId, cb) {
  const q = query(eventsRef, where('familyId', '==', familyId), orderBy('date', 'asc'));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        date: data.date?.toDate ? data.date.toDate() : data.date,
      };
    });
    cb(list);
  });
}

export function createEvent({ familyId, userId, title, description, date }) {
  return addDoc(eventsRef, {
    familyId,
    userId,
    title: title.trim(),
    description: description?.trim() || '',
    date: Timestamp.fromDate(date),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateEvent(id, { title, description, date }) {
  return updateDoc(doc(db, 'events', id), {
    title: title.trim(),
    description: description?.trim() || '',
    date: Timestamp.fromDate(date),
    updatedAt: serverTimestamp(),
  });
}

export function deleteEvent(id) {
  return deleteDoc(doc(db, 'events', id));
}
