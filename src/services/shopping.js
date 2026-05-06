import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const itemsRef = collection(db, 'shoppingItems');

function toDate(value) {
  if (!value) return null;
  return value?.toDate ? value.toDate() : value;
}

export function subscribeShoppingItems(familyId, cb) {
  const q = query(itemsRef, where('familyId', '==', familyId));
  return onSnapshot(q, (snap) => {
    const list = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          done: Boolean(data.done),
          quantity: data.quantity || '',
          createdAt: toDate(data.createdAt),
          completedAt: toDate(data.completedAt),
        };
      })
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        const ta = a.createdAt ? a.createdAt.getTime() : 0;
        const tb = b.createdAt ? b.createdAt.getTime() : 0;
        return tb - ta;
      });
    cb(list);
  });
}

export function createShoppingItem({ familyId, userId, title, quantity }) {
  return addDoc(itemsRef, {
    familyId,
    userId,
    title: title.trim(),
    quantity: (quantity || '').trim(),
    done: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    completedAt: null,
  });
}

export function setShoppingItemDone(id, done) {
  return updateDoc(doc(db, 'shoppingItems', id), {
    done: Boolean(done),
    completedAt: done ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}

export function updateShoppingItem(id, { title, quantity }) {
  return updateDoc(doc(db, 'shoppingItems', id), {
    title: title.trim(),
    quantity: (quantity || '').trim(),
    updatedAt: serverTimestamp(),
  });
}

export function deleteShoppingItem(id) {
  return deleteDoc(doc(db, 'shoppingItems', id));
}

export async function clearCompletedShoppingItems(familyId) {
  const q = query(itemsRef, where('familyId', '==', familyId));
  const snap = await getDocs(q);
  const targets = snap.docs.filter((d) => d.data().done === true);
  if (targets.length === 0) return 0;
  const batch = writeBatch(db);
  targets.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return targets.length;
}
