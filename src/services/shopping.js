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
import { joinQuantities, normalizeTitle, parseIngredient } from '../utils/ingredients';
import { guessProductIcon } from '../utils/productIcons';
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
export async function seedDefaultShoppingItems({ familyId, userId, locale = 'en' }) {
  const payload = (item) => ({
    familyId,
    userId,
    title: item[locale] || item.en,
    quantity: '',
    icon: item.icon || '',
    urgent: false,
    offer: false,
    ifConvenient: false,
    done: true,
    seeded: true,
  });

  if (isDemoMode()) {
    for (const item of DEFAULT_SHOPPING_ITEMS) {
      const now = new Date();
      await demoAdd('shoppingItems', {
        ...payload(item),
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });
    }
    return;
  }

  const batch = writeBatch(db);
  for (const item of DEFAULT_SHOPPING_ITEMS) {
    batch.set(doc(itemsRef), {
      ...payload(item),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      completedAt: serverTimestamp(),
    });
  }
  await batch.commit();
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

// Decide what adding a set of ingredient lines to the list would do, without
// touching the database. Pure on purpose: the review modal renders exactly the
// decisions the writer will then carry out, so the preview can never disagree
// with the result, and there is no read-modify-write window inside the service.
//
// `existingItems` comes from the useShoppingItems subscription the page
// already holds — matching the repo's "hooks subscribe, services write" split.
export function planShoppingAdditions({ lines, existingItems = [] }) {
  const openByTitle = new Map();
  const doneByTitle = new Map();
  for (const item of existingItems) {
    const key = normalizeTitle(item.title);
    if (!key) continue;
    if (item.done) {
      // Several "recently used" tiles can share a title; the most recently
      // completed one is the one the family last touched.
      const current = doneByTitle.get(key);
      const better =
        !current ||
        (item.completedAt?.getTime?.() || 0) > (current.completedAt?.getTime?.() || 0);
      if (better) doneByTitle.set(key, item);
    } else {
      openByTitle.set(key, item);
    }
  }

  const byKey = new Map();
  for (const line of lines) {
    const { quantity, title } = parseIngredient(line);
    const key = normalizeTitle(title);
    if (!key) continue;
    const entry = byKey.get(key);
    if (entry) {
      entry.count += 1;
      entry.quantities.push(quantity);
    } else {
      byKey.set(key, { key, title, quantities: [quantity], count: 1 });
    }
  }

  return [...byKey.values()].map((entry) => {
    const quantity = joinQuantities(entry.quantities);
    const open = openByTitle.get(entry.key);
    if (open) {
      return { ...entry, quantity, action: 'skip', existingId: open.id };
    }
    const done = doneByTitle.get(entry.key);
    if (done) {
      // Reactivating is what tapping a "recently used" tile does, and it keeps
      // the icon and the urgent/offer/ifConvenient flags the family set. A
      // parallel document would throw all of that away and leave a duplicate.
      return { ...entry, quantity, action: 'reactivate', existingId: done.id };
    }
    return { ...entry, quantity, action: 'create', existingId: null };
  });
}

export async function addShoppingItemsBulk({ familyId, userId, plan }) {
  const creates = plan.filter((p) => p.action === 'create');
  const reactivates = plan.filter((p) => p.action === 'reactivate');
  const skipped = plan.filter((p) => p.action === 'skip').length;

  if (isDemoMode()) {
    for (const entry of creates) {
      const now = new Date();
      await demoAdd('shoppingItems', {
        familyId,
        userId,
        title: entry.title,
        quantity: entry.quantity || '',
        icon: guessProductIcon(entry.title),
        urgent: false,
        offer: false,
        ifConvenient: false,
        done: false,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    }
    // The family's own quantity wins over whatever the recipe said, so a
    // reactivation only flips `done`.
    for (const entry of reactivates) {
      await demoUpdate('shoppingItems', entry.existingId, {
        done: false,
        completedAt: null,
        updatedAt: new Date(),
      });
    }
    return { added: creates.length + reactivates.length, reactivated: reactivates.length, skipped };
  }

  // A week of meals is far below the 500-operation batch limit.
  const batch = writeBatch(db);
  for (const entry of creates) {
    batch.set(doc(itemsRef), {
      familyId,
      userId,
      title: entry.title,
      quantity: entry.quantity || '',
      icon: guessProductIcon(entry.title),
      urgent: false,
      offer: false,
      ifConvenient: false,
      done: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      completedAt: null,
    });
  }
  for (const entry of reactivates) {
    batch.update(doc(db, 'shoppingItems', entry.existingId), {
      done: false,
      completedAt: null,
      updatedAt: serverTimestamp(),
    });
  }
  if (creates.length || reactivates.length) await batch.commit();
  return { added: creates.length + reactivates.length, reactivated: reactivates.length, skipped };
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
