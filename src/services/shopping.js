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
import { DEFAULT_SHOPPING_ITEMS } from '../constants/defaultShoppingItems';
import { isDemoMode } from '../lib/demoMode';
import { demoAdd, demoDelete, demoDocs, demoSubscribe, demoUpdate } from './demoStore';

const itemsRef = collection(db, 'shoppingItems');

const nowVal = () => (isDemoMode() ? new Date() : serverTimestamp());

function toDate(value) {
  if (!value) return null;
  return value?.toDate ? value.toDate() : value;
}

function mapItemDocs(docs) {
  return docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        done: Boolean(data.done),
        quantity: data.quantity || '',
        icon: data.icon || '',
        urgent: Boolean(data.urgent),
        offer: Boolean(data.offer),
        ifConvenient: Boolean(data.ifConvenient),
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
}

export function subscribeShoppingItems(familyId, cb) {
  if (isDemoMode()) return demoSubscribe('shoppingItems', (docs) => cb(mapItemDocs(docs)));
  const q = query(itemsRef, where('familyId', '==', familyId));
  return onSnapshot(q, (snap) => cb(mapItemDocs(snap.docs)));
}

export function createShoppingItem({ familyId, userId, title, quantity, icon }) {
  const payload = {
    familyId,
    userId,
    title: title.trim(),
    quantity: (quantity || '').trim(),
    icon: icon || '',
    urgent: false,
    offer: false,
    ifConvenient: false,
    done: false,
    createdAt: nowVal(),
    updatedAt: nowVal(),
    completedAt: null,
  };
  if (isDemoMode()) return demoAdd('shoppingItems', payload);
  return addDoc(itemsRef, payload);
}

// Seed a new family's list with typical everyday products as "recently used"
// suggestions so the page isn't empty on first use. Best-effort: callers
// should not let a seeding failure block family creation.
export function seedDefaultShoppingItems({ familyId, userId, locale = 'en' }) {
  const batch = writeBatch(db);
  for (const item of DEFAULT_SHOPPING_ITEMS) {
    const title = item[locale] || item.en;
    batch.set(doc(itemsRef), {
      familyId,
      userId,
      title,
      quantity: '',
      icon: item.icon || '',
      urgent: false,
      offer: false,
      ifConvenient: false,
      done: true,
      seeded: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      completedAt: serverTimestamp(),
    });
  }
  return batch.commit();
}

export function setShoppingItemDone(id, done) {
  const payload = {
    done: Boolean(done),
    completedAt: done ? nowVal() : null,
    updatedAt: nowVal(),
  };
  if (isDemoMode()) return demoUpdate('shoppingItems', id, payload);
  return updateDoc(doc(db, 'shoppingItems', id), payload);
}

export function updateShoppingItem(id, fields) {
  const patch = { updatedAt: nowVal() };
  if (fields.title !== undefined) patch.title = fields.title.trim();
  if (fields.quantity !== undefined) patch.quantity = (fields.quantity || '').trim();
  if (fields.icon !== undefined) patch.icon = fields.icon || '';
  if (fields.urgent !== undefined) patch.urgent = Boolean(fields.urgent);
  if (fields.offer !== undefined) patch.offer = Boolean(fields.offer);
  if (fields.ifConvenient !== undefined) patch.ifConvenient = Boolean(fields.ifConvenient);
  if (isDemoMode()) return demoUpdate('shoppingItems', id, patch);
  return updateDoc(doc(db, 'shoppingItems', id), patch);
}

export function deleteShoppingItem(id) {
  if (isDemoMode()) return demoDelete('shoppingItems', id);
  return deleteDoc(doc(db, 'shoppingItems', id));
}

export async function clearCompletedShoppingItems(familyId) {
  if (isDemoMode()) {
    const targets = demoDocs('shoppingItems').filter((d) => d.data().done === true);
    for (const d of targets) await demoDelete('shoppingItems', d.id);
    return targets.length;
  }
  const q = query(itemsRef, where('familyId', '==', familyId));
  const snap = await getDocs(q);
  const targets = snap.docs.filter((d) => d.data().done === true);
  if (targets.length === 0) return 0;
  const batch = writeBatch(db);
  targets.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return targets.length;
}
