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

const vaccinationsRef = collection(db, 'vaccinations');

const VALID_STATUSES = ['done', 'next_up', 'pending'];

const nowVal = () => (isDemoMode() ? new Date() : serverTimestamp());

function normalizeStatus(status) {
  return VALID_STATUSES.includes(status) ? status : 'pending';
}

function toDate(value) {
  if (!value) return null;
  return value?.toDate ? value.toDate() : value;
}

function isoToDate(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0);
}

function isoVal(isoStr) {
  const d = isoToDate(isoStr);
  return isDemoMode() ? d : Timestamp.fromDate(d);
}

function mapVaccinationDocs(docs) {
  return docs
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
}

// Subscribe to all vaccinations for a family. Sorted client-side by date
// (single-field query avoids needing a composite Firestore index).
export function subscribeVaccinations(familyId, cb) {
  if (isDemoMode()) return demoSubscribe('vaccinations', (docs) => cb(mapVaccinationDocs(docs)));
  const q = query(vaccinationsRef, where('familyId', '==', familyId));
  return onSnapshot(q, (snap) => cb(mapVaccinationDocs(snap.docs)));
}

export function createVaccination({ familyId, userId, kidId, name, status, date }) {
  const payload = {
    familyId,
    userId,
    kidId,
    name: name.trim(),
    status: normalizeStatus(status),
    date: isoVal(date),
    createdAt: nowVal(),
    updatedAt: nowVal(),
  };
  if (isDemoMode()) return demoAdd('vaccinations', payload);
  return addDoc(vaccinationsRef, payload);
}

export function updateVaccination(id, { name, status, date }) {
  const payload = {
    name: name.trim(),
    status: normalizeStatus(status),
    date: isoVal(date),
    updatedAt: nowVal(),
  };
  if (isDemoMode()) return demoUpdate('vaccinations', id, payload);
  return updateDoc(doc(db, 'vaccinations', id), payload);
}

export function deleteVaccination(id) {
  if (isDemoMode()) return demoDelete('vaccinations', id);
  return deleteDoc(doc(db, 'vaccinations', id));
}
