import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

const KID_COLORS = ['violet', 'sky', 'pink', 'teal', 'orange', 'indigo'];
import { db } from '../lib/firebase';
import { generateInviteCode } from '../utils/inviteCode';
import { DEFAULT_CATEGORY } from '../constants/eventCategories';
import { reassignEventsCategory } from './events';

const familiesRef = collection(db, 'families');

async function codeIsUnique(code) {
  const q = query(familiesRef, where('inviteCode', '==', code), limit(1));
  const snap = await getDocs(q);
  return snap.empty;
}

export async function createFamily({ name, uid }) {
  let code = generateInviteCode();
  for (let i = 0; i < 5; i += 1) {
    if (await codeIsUnique(code)) break;
    code = generateInviteCode();
  }
  const ref = await addDoc(familiesRef, {
    name: name.trim() || 'My Family',
    inviteCode: code,
    createdBy: uid,
    memberIds: [uid],
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'users', uid), { familyId: ref.id });
  return { id: ref.id, inviteCode: code };
}

export async function joinFamilyByCode({ code, uid }) {
  const cleaned = code.trim().toUpperCase();
  const q = query(familiesRef, where('inviteCode', '==', cleaned), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) {
    const err = new Error('No family found with that code.');
    err.code = 'family/not-found';
    throw err;
  }
  const famDoc = snap.docs[0];
  await updateDoc(famDoc.ref, { memberIds: arrayUnion(uid) });
  await updateDoc(doc(db, 'users', uid), { familyId: famDoc.id });
  return { id: famDoc.id };
}

export function subscribeFamily(familyId, cb) {
  return onSnapshot(doc(db, 'families', familyId), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export async function addFamilyCategory(familyId, { label, color }) {
  const trimmed = label.trim();
  if (!trimmed) throw new Error('Category name is required.');
  const category = {
    id: `cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    label: trimmed,
    color,
  };
  await updateDoc(doc(db, 'families', familyId), {
    customCategories: arrayUnion(category),
  });
  return category;
}

export async function addKid(familyId, name, existingKidsCount = 0) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Child name is required.');
  const kid = {
    id: `kid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed,
    color: KID_COLORS[existingKidsCount % KID_COLORS.length],
  };
  await updateDoc(doc(db, 'families', familyId), {
    kids: arrayUnion(kid),
  });
  return kid;
}

export async function removeKid(familyId, kid) {
  const famRef = doc(db, 'families', familyId);
  const snap = await getDoc(famRef);
  const list = (snap.data()?.kids || []).filter((k) => k && k.id !== kid.id);
  await updateDoc(famRef, { kids: list });
}

// Delete a category. Built-ins are hidden via `disabledBuiltins`; customs are
// removed from `customCategories`. Any events still pointing at the deleted
// category are reassigned to `general` so they never render as "unknown".
export function updateGiftBudget(familyId, amount) {
  return updateDoc(doc(db, 'families', familyId), {
    giftBudget: Math.max(0, Number(amount) || 0),
  });
}

export async function deleteCategory(familyId, category) {
  if (category.id === DEFAULT_CATEGORY) {
    throw new Error("'General' cannot be deleted.");
  }
  await reassignEventsCategory(familyId, category.id, DEFAULT_CATEGORY);
  const famRef = doc(db, 'families', familyId);
  if (category.builtin) {
    await updateDoc(famRef, { disabledBuiltins: arrayUnion(category.id) });
  } else {
    // arrayRemove needs an exact object match; we read-filter-write instead
    // so users can delete a custom category even if its shape drifted.
    const snap = await getDoc(famRef);
    const list = (snap.data()?.customCategories || []).filter(
      (c) => c && c.id !== category.id
    );
    await updateDoc(famRef, { customCategories: list });
  }
}
