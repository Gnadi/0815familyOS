import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { generateInviteCode } from '../utils/inviteCode';

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
