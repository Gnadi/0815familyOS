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
import { isDemoMode } from '../lib/demoMode';
import { demoAdd, demoDelete, demoSubscribe, demoUpdate } from './demoStore';

const giftsRef = collection(db, 'gifts');

const nowVal = () => (isDemoMode() ? new Date() : serverTimestamp());

function normalizeStatus(status) {
  return ['idea', 'bought', 'gifted'].includes(status) ? status : 'idea';
}

function toDate(value) {
  if (!value) return null;
  return value?.toDate ? value.toDate() : value;
}

function mapGiftDocs(docs) {
  return docs
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
}

export function subscribeGifts(familyId, cb) {
  if (isDemoMode()) return demoSubscribe('gifts', (docs) => cb(mapGiftDocs(docs)));
  const q = query(giftsRef, where('familyId', '==', familyId));
  return onSnapshot(q, (snap) => cb(mapGiftDocs(snap.docs)));
}

export function createGift({ familyId, kidId, title, price, status, notes }) {
  const payload = {
    familyId,
    kidId,
    title: title.trim(),
    price: Math.max(0, Number(price) || 0),
    status: normalizeStatus(status),
    notes: notes?.trim() || '',
    createdAt: nowVal(),
    updatedAt: nowVal(),
  };
  if (isDemoMode()) return demoAdd('gifts', payload);
  return addDoc(giftsRef, payload);
}

export function updateGift(id, { title, kidId, price, status, notes }) {
  const payload = {
    title: title.trim(),
    kidId,
    price: Math.max(0, Number(price) || 0),
    status: normalizeStatus(status),
    notes: notes?.trim() || '',
    updatedAt: nowVal(),
  };
  if (isDemoMode()) return demoUpdate('gifts', id, payload);
  return updateDoc(doc(db, 'gifts', id), payload);
}

export function deleteGift(id) {
  if (isDemoMode()) return demoDelete('gifts', id);
  return deleteDoc(doc(db, 'gifts', id));
}
