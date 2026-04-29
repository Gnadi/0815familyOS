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

const vaccinationsRef = collection(db, 'vaccinations');

const VALID_STATUSES = ['done', 'next_up', 'pending'];

function normalizeStatus(status) {
  return VALID_STATUSES.includes(status) ? status : 'pending';
}

function toDate(value) {
  if (!value) return null;
  return value?.toDate ? value.toDate() : value;
}

function isoToTimestamp(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  return Timestamp.fromDate(new Date(y, m - 1, d, 12, 0));
}

// Subscribe to all vaccinations for a family. Sorted client-side by date
// (single-field query avoids needing a composite Firestore index).
export function subscribeVaccinations(familyId, cb) {
  const q = query(vaccinationsRef, where('familyId', '==', familyId));
  return onSnapshot(q, (snap) => {
    const list = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          status: normalizeStatus(data.status),
          date: toDate(data.date),
          createdAt: toDate(data.createdAt),
        };
      })
      .sort((a, b) => {
        const ta = a.date ? a.date.getTime() : 0;
        const tb = b.date ? b.date.getTime() : 0;
        return ta - tb;
      });
    cb(list);
  });
}

export function createVaccination({ familyId, userId, kidId, name, status, date }) {
  return addDoc(vaccinationsRef, {
    familyId,
    userId,
    kidId,
    name: name.trim(),
    status: normalizeStatus(status),
    date: isoToTimestamp(date),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateVaccination(id, { name, status, date }) {
  return updateDoc(doc(db, 'vaccinations', id), {
    name: name.trim(),
    status: normalizeStatus(status),
    date: isoToTimestamp(date),
    updatedAt: serverTimestamp(),
  });
}

export function deleteVaccination(id) {
  return deleteDoc(doc(db, 'vaccinations', id));
}
