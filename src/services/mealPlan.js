import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const entriesRef = collection(db, 'mealPlanEntries');

function toDate(value) {
  if (!value) return null;
  return value?.toDate ? value.toDate() : value;
}

// Subscribe to every meal entry for the family. Like events, we filter by
// familyId only (no composite index needed) and let the page slice out the
// visible week client-side.
export function subscribeMealPlan(familyId, cb) {
  const q = query(entriesRef, where('familyId', '==', familyId));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        slot: data.slot || 'dinner',
        recipeId: data.recipeId || null,
        text: data.text || '',
        cookId: data.cookId || null,
        cookType: data.cookType || null,
        cookName: data.cookName || '',
        date: toDate(data.date),
      };
    });
    cb(list);
  });
}

export function createMealEntry({ familyId, userId, date, slot, recipeId, text, cookId, cookType, cookName }) {
  return addDoc(entriesRef, {
    familyId,
    userId,
    date: Timestamp.fromDate(date),
    slot,
    recipeId: recipeId || null,
    text: (text || '').trim(),
    cookId: cookId || null,
    cookType: cookType || null,
    cookName: (cookName || '').trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateMealEntry(id, { recipeId, text, cookId, cookType, cookName }) {
  return updateDoc(doc(db, 'mealPlanEntries', id), {
    recipeId: recipeId || null,
    text: (text || '').trim(),
    cookId: cookId || null,
    cookType: cookType || null,
    cookName: (cookName || '').trim(),
    updatedAt: serverTimestamp(),
  });
}

export function deleteMealEntry(id) {
  return deleteDoc(doc(db, 'mealPlanEntries', id));
}
