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
import { indexShoppingItems, resolveExisting } from '../utils/smartShopping';
import { isDemoMode } from '../lib/demoMode';
import { demoAdd, demoDelete, demoDocs, demoSubscribe, demoUpdate } from './demoStore';
import {
  logProductWriteError,
  preparePurchase,
  removePurchase,
  writePurchase,
} from './shoppingProducts';

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
        // Which list the item waits on in weekly mode: the weekly shop, or
        // "in between" for fresh food. Ignored by the running-list mode.
        list: data.list === 'fresh' ? 'fresh' : 'main',
        lastPurchase: data.lastPurchase || null,
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

export function createShoppingItem({ familyId, userId, title, quantity, icon, list }) {
  const payload = {
    familyId,
    userId,
    title: title.trim(),
    quantity: (quantity || '').trim(),
    icon: icon || '',
    urgent: false,
    offer: false,
    ifConvenient: false,
    list: list === 'fresh' ? 'fresh' : 'main',
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

function writeItem(id, patch) {
  if (isDemoMode()) return demoUpdate('shoppingItems', id, patch);
  return updateDoc(doc(db, 'shoppingItems', id), patch);
}

function productFor(products, productId) {
  return (products || []).find((p) => p.id === productId) || null;
}

// Checking an item off is the family buying it, and the one signal the smart
// list learns from — no extra input asked for. The entry is stored on the item
// as well, so a mis-tap can be taken back out of the log (see reopen below).
export function checkOffShoppingItem(item, { familyId, userId, products, now = new Date() }) {
  const purchase = preparePurchase({ familyId, title: item.title, at: now });
  if (purchase) {
    writePurchase({
      familyId,
      userId,
      title: item.title,
      purchase,
      product: productFor(products, purchase.productId),
    }).catch(logProductWriteError);
  }
  return writeItem(item.id, {
    done: true,
    completedAt: nowVal(),
    updatedAt: nowVal(),
    lastPurchase: purchase,
  });
}

// Re-opening an item this soon after checking it off is a mis-tap, not a
// purchase followed by running out again.
export const UNDO_WINDOW_MS = 15 * 60 * 1000;

// Seeded starter tiles are created already "done"; their completedAt is the
// family's creation, not a purchase.
const SEED_COMPLETION_SLACK_MS = 5 * 60 * 1000;

function isSeedCompletion(item) {
  if (!item.seeded) return false;
  const created = item.createdAt?.getTime?.();
  const completed = item.completedAt?.getTime?.();
  return !created || !completed || Math.abs(completed - created) < SEED_COMPLETION_SLACK_MS;
}

// What putting `item` back on the list means for the purchase log:
//  - checked off moments ago (and this is the tile tap, `allowUndo`): take the
//    purchase back out;
//  - checked off before the log existed: record that purchase now, at the
//    last moment its date is still known — reopening clears completedAt.
function settlePurchaseOnReopen(item, { familyId, userId, products, allowUndo, now }) {
  const last = item.lastPurchase;
  if (last?.entry) {
    const at = toDate(last.entry.at);
    if (allowUndo && at && now.getTime() - at.getTime() < UNDO_WINDOW_MS) {
      removePurchase(last).catch(logProductWriteError);
    }
    return;
  }
  if (!item.completedAt || isSeedCompletion(item)) return;
  const purchase = preparePurchase({ familyId, title: item.title, at: item.completedAt });
  if (!purchase) return;
  writePurchase({
    familyId,
    userId,
    title: item.title,
    purchase,
    product: productFor(products, purchase.productId),
  }).catch(logProductWriteError);
}

export function reopenShoppingItem(item, { familyId, userId, products, list, now = new Date() }) {
  settlePurchaseOnReopen(item, { familyId, userId, products, allowUndo: true, now });
  const patch = { done: false, completedAt: null, updatedAt: nowVal(), lastPurchase: null };
  if (list) patch.list = list === 'fresh' ? 'fresh' : 'main';
  return writeItem(item.id, patch);
}

export function updateShoppingItem(id, fields) {
  const patch = { updatedAt: nowVal() };
  if (fields.title !== undefined) patch.title = fields.title.trim();
  if (fields.quantity !== undefined) patch.quantity = (fields.quantity || '').trim();
  if (fields.icon !== undefined) patch.icon = fields.icon || '';
  if (fields.urgent !== undefined) patch.urgent = Boolean(fields.urgent);
  if (fields.offer !== undefined) patch.offer = Boolean(fields.offer);
  if (fields.ifConvenient !== undefined) patch.ifConvenient = Boolean(fields.ifConvenient);
  if (fields.list !== undefined) patch.list = fields.list === 'fresh' ? 'fresh' : 'main';
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
  const index = indexShoppingItems(existingItems);

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

  // Reactivating is what tapping a "recently used" tile does, and it keeps the
  // icon and the urgent/offer/ifConvenient flags the family set. A parallel
  // document would throw all of that away and leave a duplicate.
  return [...byKey.values()].map((entry) => ({
    ...entry,
    quantity: joinQuantities(entry.quantities),
    ...resolveExisting(entry.key, index),
  }));
}

// `items` and `products` are the page's current subscriptions; they let a
// reactivation settle the purchase log like a tile tap does. `list` places
// every added item on that list (weekly mode); omitted, items keep theirs.
export async function addShoppingItemsBulk({ familyId, userId, plan, items = [], products = [], list }) {
  const creates = plan.filter((p) => p.action === 'create');
  const reactivates = plan.filter((p) => p.action === 'reactivate');
  const skipped = plan.filter((p) => p.action === 'skip').length;
  const listField = list ? { list: list === 'fresh' ? 'fresh' : 'main' } : {};
  const createList = list === 'fresh' ? 'fresh' : 'main';
  const reopenedAt = new Date();

  const byId = new Map(items.map((item) => [item.id, item]));
  for (const entry of reactivates) {
    const item = byId.get(entry.existingId);
    if (item) settlePurchaseOnReopen(item, { familyId, userId, products, allowUndo: false, now: reopenedAt });
  }

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
        list: createList,
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
        lastPurchase: null,
        ...listField,
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
      list: createList,
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
      lastPurchase: null,
      ...listField,
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
