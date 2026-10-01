import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isDemoMode } from '../lib/demoMode';
import { demoSet, demoSubscribe } from './demoStore';
import { productDocId, productKey } from '../utils/smartShopping';

// What the family has learned about each product it buys: the purchase log
// the rhythm is computed from, plus the per-product choices ("still have it",
// fresh or not, never suggest). One document per product and family; see
// docs/smart-shopping.md for why this is not one document per purchase.
//
// Every write here is auxiliary to the shopping list. Callers fire them
// without awaiting and swallow failures: a purchase that fails to log must
// never make a check-off fail, and with the offline cache a write only
// resolves once the server has it — awaiting would hang a check-off in a
// supermarket without signal.

const COL = 'shoppingProducts';
const productsRef = collection(db, COL);

// Recent behaviour is what a rhythm needs. Kept short so a product document
// stays small however long the family uses the app; trimmed in one write once
// it grows past TRIM_AT, otherwise appended atomically.
const MAX_PURCHASES = 30;
const TRIM_AT = 40;

const nowVal = () => (isDemoMode() ? new Date() : serverTimestamp());
const stampVal = (d) => (isDemoMode() ? d : Timestamp.fromDate(d));

function toDate(value) {
  if (!value) return null;
  return value?.toDate ? value.toDate() : value;
}

function mapProductDocs(docs) {
  return docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      key: data.key || '',
      title: data.title || data.key || '',
      purchases: (Array.isArray(data.purchases) ? data.purchases : [])
        .map((p) => ({ id: p?.id || '', at: toDate(p?.at), planned: Boolean(p?.planned) }))
        .filter((p) => p.at),
      stillHaveAt: toDate(data.stillHaveAt),
      fresh: typeof data.fresh === 'boolean' ? data.fresh : null,
      muted: Boolean(data.muted),
      updatedAt: toDate(data.updatedAt),
    };
  });
}

export function subscribeShoppingProducts(familyId, cb) {
  if (isDemoMode()) return demoSubscribe(COL, (docs) => cb(mapProductDocs(docs)));
  const q = query(productsRef, where('familyId', '==', familyId));
  return onSnapshot(q, (snap) => cb(mapProductDocs(snap.docs)));
}

function entryId() {
  return Math.random().toString(36).slice(2, 10);
}

// The fields every write carries, so whichever write reaches a product first
// creates a valid document. `userId` is the member who last recorded
// something for the product.
function baseFields({ familyId, userId, title }) {
  return {
    familyId,
    key: productKey(title),
    title: String(title || '').trim(),
    userId,
    updatedAt: nowVal(),
  };
}

function writeProduct(id, fields) {
  if (isDemoMode()) return demoSet(COL, id, fields);
  return setDoc(doc(db, COL, id), fields, { merge: true });
}

// Build the purchase entry synchronously, so the caller can store it on the
// shopping item (for undo) without waiting for any write. `planned` marks a
// purchase made only for planned meals; it is kept but builds no rhythm.
function entryOf({ id, at, planned }) {
  return planned ? { id, at, planned: true } : { id, at };
}

export function preparePurchase({ familyId, title, at = new Date(), planned = false }) {
  const key = productKey(title);
  if (!familyId || !key) return null;
  return {
    productId: productDocId(familyId, key),
    entry: entryOf({ id: entryId(), at: stampVal(at), planned }),
  };
}

// `product` is the family's current copy from the subscription, used only to
// decide whether this append should also trim.
export function writePurchase({ familyId, userId, title, purchase, product }) {
  const { productId, entry } = purchase;
  const known = product?.purchases || [];
  const trimmed =
    known.length >= TRIM_AT
      ? [
          ...known
            .slice(-(MAX_PURCHASES - 1))
            .map((p) => entryOf({ id: p.id, at: stampVal(p.at), planned: p.planned })),
          entry,
        ]
      : null;
  const fields = baseFields({ familyId, userId, title });

  if (isDemoMode()) {
    return demoSet(COL, productId, (existing) => ({
      ...fields,
      purchases: trimmed || [...(existing?.purchases || []), entry],
    }));
  }
  return writeProduct(productId, { ...fields, purchases: trimmed || arrayUnion(entry) });
}

// Undo of a mis-tapped check-off. arrayRemove matches the stored element
// exactly, which is why the shopping item keeps the very entry it wrote.
export function removePurchase({ productId, entry }) {
  if (isDemoMode()) {
    return demoSet(COL, productId, (existing) => ({
      purchases: (existing?.purchases || []).filter((p) => p.id !== entry.id),
    }));
  }
  return writeProduct(productId, { purchases: arrayRemove(entry), updatedAt: nowVal() });
}

// "Still have it", fresh/not fresh, never suggest. `title` identifies the
// product (and creates its document if it has never been bought).
export function updateProductPreferences({ familyId, userId, title, stillHave, fresh, muted }) {
  const key = productKey(title);
  if (!familyId || !key) return Promise.resolve();
  const fields = baseFields({ familyId, userId, title });
  if (stillHave) fields.stillHaveAt = stampVal(new Date());
  if (fresh !== undefined) fields.fresh = typeof fresh === 'boolean' ? fresh : null;
  if (muted !== undefined) fields.muted = Boolean(muted);
  return writeProduct(productDocId(familyId, key), fields);
}

export function logProductWriteError(err) {
  console.warn('Could not update the shopping history:', err);
}
