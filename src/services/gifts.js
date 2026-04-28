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
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const giftsRef = collection(db, 'gifts');

function normalizeStatus(status) {
  return ['idea', 'bought', 'gifted'].includes(status) ? status : 'idea';
}

function toDate(value) {
  if (!value) return null;
  return value?.toDate ? value.toDate() : value;
}

export function subscribeGifts(familyId, cb) {
  const q = query(giftsRef, where('familyId', '==', familyId));
  return onSnapshot(q, (snap) => {
    const list = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          status: normalizeStatus(data.status),
          price: Number(data.price) || 0,
          createdAt: toDate(data.createdAt),
        };
      })
      .sort((a, b) => {
        const ta = a.createdAt ? a.createdAt.getTime() : 0;
        const tb = b.createdAt ? b.createdAt.getTime() : 0;
        return tb - ta;
      });
    cb(list);
  });
}

export function createGift({ familyId, kidId, title, price, status, notes }) {
  return addDoc(giftsRef, {
    familyId,
    kidId,
    title: title.trim(),
    price: Math.max(0, Number(price) || 0),
    status: normalizeStatus(status),
    notes: notes?.trim() || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateGift(id, { title, kidId, price, status, notes }) {
  return updateDoc(doc(db, 'gifts', id), {
    title: title.trim(),
    kidId,
    price: Math.max(0, Number(price) || 0),
    status: normalizeStatus(status),
    notes: notes?.trim() || '',
    updatedAt: serverTimestamp(),
  });
}

export function deleteGift(id) {
  return deleteDoc(doc(db, 'gifts', id));
}
