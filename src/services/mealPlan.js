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
import { isDemoMode } from '../lib/demoMode';
import { demoAdd, demoDelete, demoSubscribe, demoUpdate } from './demoStore';

const entriesRef = collection(db, 'mealPlanEntries');

const nowVal = () => (isDemoMode() ? new Date() : serverTimestamp());
const dateVal = (d) => (isDemoMode() ? d : Timestamp.fromDate(d));

function toDate(value) {
  if (!value) return null;
  return value?.toDate ? value.toDate() : value;
}

function mapEntryDocs(docs) {
  return docs.map((d) => {
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
}

// Subscribe to every meal entry for the family. Like events, we filter by
// familyId only (no composite index needed) and let the page slice out the
// visible week client-side.
export function subscribeMealPlan(familyId, cb) {
  if (isDemoMode()) return demoSubscribe('mealPlanEntries', (docs) => cb(mapEntryDocs(docs)));
  const q = query(entriesRef, where('familyId', '==', familyId));
  return onSnapshot(q, (snap) => cb(mapEntryDocs(snap.docs)));
}

export function createMealEntry({ familyId, userId, date, slot, recipeId, text, cookId, cookType, cookName }) {
  const payload = {
    familyId,
    userId,
    date: dateVal(date),
    slot,
    recipeId: recipeId || null,
    text: (text || '').trim(),
    cookId: cookId || null,
    cookType: cookType || null,
    cookName: (cookName || '').trim(),
    createdAt: nowVal(),
    updatedAt: nowVal(),
  };
  if (isDemoMode()) return demoAdd('mealPlanEntries', payload);
  return addDoc(entriesRef, payload);
}

export function updateMealEntry(id, { recipeId, text, cookId, cookType, cookName }) {
  const payload = {
    recipeId: recipeId || null,
    text: (text || '').trim(),
    cookId: cookId || null,
    cookType: cookType || null,
    cookName: (cookName || '').trim(),
    updatedAt: nowVal(),
  };
  if (isDemoMode()) return demoUpdate('mealPlanEntries', id, payload);
  return updateDoc(doc(db, 'mealPlanEntries', id), payload);
}

export function deleteMealEntry(id) {
  if (isDemoMode()) return demoDelete('mealPlanEntries', id);
  return deleteDoc(doc(db, 'mealPlanEntries', id));
}
