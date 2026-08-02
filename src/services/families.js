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
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

const KID_COLORS = ['violet', 'sky', 'pink', 'teal', 'orange', 'indigo'];
import { db } from '../lib/firebase';
import { generateInviteCode } from '../utils/inviteCode';
import { DEFAULT_CATEGORY } from '../constants/eventCategories';
import { reassignEventsCategory } from './events';
import { seedDefaultShoppingItems } from './shopping';
import { generateEncryptionKey } from '../utils/encryption';
import { isDemoMode } from '../lib/demoMode';
import { demoGetFamily, demoSubscribeFamily, demoUpdateFamily } from './demoStore';

const familiesRef = collection(db, 'families');

// Demo-aware family read/patch used by the CRUD helpers below, so each of
// them stays a single code path regardless of mode.
async function readFamilyData(familyId) {
  if (isDemoMode()) return demoGetFamily();
  const snap = await getDoc(doc(db, 'families', familyId));
  return snap.data() || {};
}

function writeFamily(familyId, patch) {
  if (isDemoMode()) return demoUpdateFamily(patch);
  return updateDoc(doc(db, 'families', familyId), patch);
}

// arrayUnion-style append that works in both modes: in demo the array is
// rebuilt from the store; against Firestore the atomic arrayUnion is kept.
function appendToFamilyArray(familyId, field, value) {
  if (isDemoMode()) {
    const list = demoGetFamily()[field] || [];
    return demoUpdateFamily({ [field]: [...list, value] });
  }
  return updateDoc(doc(db, 'families', familyId), { [field]: arrayUnion(value) });
}

async function codeIsUnique(code) {
  const q = query(familiesRef, where('inviteCode', '==', code), limit(1));
  const snap = await getDocs(q);
  return snap.empty;
}

export async function createFamily({ name, uid, locale = 'en' }) {
  let code = generateInviteCode();
  for (let i = 0; i < 5; i += 1) {
    if (await codeIsUnique(code)) break;
    code = generateInviteCode();
  }
  const { jwk } = await generateEncryptionKey();
  const ref = await addDoc(familiesRef, {
    name: name.trim() || 'My Family',
    inviteCode: code,
    createdBy: uid,
    memberIds: [uid],
    encryptionKeyJwk: jwk,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'users', uid), { familyId: ref.id });
  // Seed starter shopping items so the list isn't empty on first use.
  // Best-effort — never let this fail family creation.
  try {
    await seedDefaultShoppingItems({ familyId: ref.id, userId: uid, locale });
  } catch {
    /* ignore seeding failures */
  }
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

// Backfills `encryptionKeyJwk` on families created before the document vault
// existed. Runs in a transaction: if two members open the app at the same
// moment they would otherwise each generate a key and the last write would win,
// leaving anything the loser had already encrypted permanently unreadable.
// Whoever loses the race adopts the committed key instead.
export async function ensureFamilyEncryptionKey(familyId) {
  if (isDemoMode()) {
    const existing = demoGetFamily().encryptionKeyJwk;
    if (existing) return existing;
    const { jwk } = await generateEncryptionKey();
    await demoUpdateFamily({ encryptionKeyJwk: jwk });
    return jwk;
  }
  const ref = doc(db, 'families', familyId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.data()?.encryptionKeyJwk;
    if (existing) return existing;
    const { jwk } = await generateEncryptionKey();
    tx.update(ref, { encryptionKeyJwk: jwk });
    return jwk;
  });
}

export function subscribeFamily(familyId, cb) {
  if (isDemoMode()) return demoSubscribeFamily(cb);
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
  await appendToFamilyArray(familyId, 'customCategories', category);
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
  await appendToFamilyArray(familyId, 'kids', kid);
  return kid;
}

export async function removeKid(familyId, kid) {
  const data = await readFamilyData(familyId);
  const list = (data.kids || []).filter((k) => k && k.id !== kid.id);
  await writeFamily(familyId, { kids: list });
}

// Gift-only recipients (e.g. grandparents) that exist solely in the Gift
// Planner. Stored separately from `kids` so they never surface in the
// calendar, health, or other kid-aware features. Mirrors the kids CRUD.
export async function addGiftRecipient(familyId, name, existingCount = 0, birthday = null) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Recipient name is required.');
  const recipient = {
    id: `recip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed,
    color: KID_COLORS[existingCount % KID_COLORS.length],
    birthday: birthday ? String(birthday) : null,
  };
  await appendToFamilyArray(familyId, 'giftRecipients', recipient);
  return recipient;
}

export async function updateGiftRecipient(familyId, recipientId, fields) {
  const data = await readFamilyData(familyId);
  const list = (data.giftRecipients || []).map((r) => {
    if (!r || r.id !== recipientId) return r;
    const next = { ...r };
    if (fields.name !== undefined) next.name = String(fields.name).trim() || r.name;
    if (fields.birthday !== undefined) {
      next.birthday = fields.birthday ? String(fields.birthday) : null;
    }
    return next;
  });
  await writeFamily(familyId, { giftRecipients: list });
}

export async function removeGiftRecipient(familyId, recipient) {
  const data = await readFamilyData(familyId);
  const list = (data.giftRecipients || []).filter(
    (r) => r && r.id !== recipient.id
  );
  await writeFamily(familyId, { giftRecipients: list });
}

// Meal cooks: external people (e.g. grandparents, a babysitter) who can be
// assigned as the cook for a meal in the week plan. Kept as its own list,
// separate from gift recipients, so the two features stay independent.
// Mirrors the kids / gift-recipient CRUD.
export async function addCook(familyId, name, existingCount = 0) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Name is required.');
  const cook = {
    id: `cook_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed,
    color: KID_COLORS[existingCount % KID_COLORS.length],
  };
  await appendToFamilyArray(familyId, 'cooks', cook);
  return cook;
}

export async function removeCook(familyId, cook) {
  const data = await readFamilyData(familyId);
  const list = (data.cooks || []).filter((c) => c && c.id !== cook.id);
  await writeFamily(familyId, { cooks: list });
}

// Update a single kid's editable fields (currently: name, birthday).
// `birthday` is stored as an ISO date string YYYY-MM-DD or null.
export async function updateKid(familyId, kidId, fields) {
  const data = await readFamilyData(familyId);
  const list = (data.kids || []).map((k) => {
    if (!k || k.id !== kidId) return k;
    const next = { ...k };
    if (fields.name !== undefined) next.name = String(fields.name).trim() || k.name;
    if (fields.birthday !== undefined) {
      next.birthday = fields.birthday ? String(fields.birthday) : null;
    }
    return next;
  });
  await writeFamily(familyId, { kids: list });
}

// Delete a category. Built-ins are hidden via `disabledBuiltins`; customs are
// removed from `customCategories`. Any events still pointing at the deleted
// category are reassigned to `general` so they never render as "unknown".
export function updateGiftBudget(familyId, amount) {
  return writeFamily(familyId, {
    giftBudget: Math.max(0, Number(amount) || 0),
  });
}

export async function deleteCategory(familyId, category) {
  if (category.id === DEFAULT_CATEGORY) {
    throw new Error("'General' cannot be deleted.");
  }
  await reassignEventsCategory(familyId, category.id, DEFAULT_CATEGORY);
  if (category.builtin) {
    await appendToFamilyArray(familyId, 'disabledBuiltins', category.id);
  } else {
    // arrayRemove needs an exact object match; we read-filter-write instead
    // so users can delete a custom category even if its shape drifted.
    const data = await readFamilyData(familyId);
    const list = (data.customCategories || []).filter(
      (c) => c && c.id !== category.id
    );
    await writeFamily(familyId, { customCategories: list });
  }
}

export async function addVaultCategory(familyId, vaultType, { label, color }) {
  const trimmed = label.trim();
  if (!trimmed) throw new Error('Category name is required.');
  const category = {
    id: `vcat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    label: trimmed,
    color,
  };
  const field = vaultType === 'trophy' ? 'customTrophyCategories' : 'customDocCategories';
  await appendToFamilyArray(familyId, field, category);
  return category;
}

export async function deleteVaultCategory(familyId, vaultType, category) {
  const customField = vaultType === 'trophy' ? 'customTrophyCategories' : 'customDocCategories';
  const disabledField = vaultType === 'trophy' ? 'disabledTrophyCategories' : 'disabledDocCategories';

  if (category.builtin) {
    await appendToFamilyArray(familyId, disabledField, category.id);
  } else {
    const data = await readFamilyData(familyId);
    const list = (data[customField] || []).filter((c) => c && c.id !== category.id);
    await writeFamily(familyId, { [customField]: list });
  }
}
