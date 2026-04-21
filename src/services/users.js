import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export async function ensureUserDoc(user, extras = {}) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email,
      displayName: extras.displayName || user.displayName || user.email?.split('@')[0] || 'User',
      familyId: null,
      createdAt: serverTimestamp(),
    });
  }
}

export function subscribeUserDoc(uid, cb) {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export function updateUserDoc(uid, patch) {
  return updateDoc(doc(db, 'users', uid), patch);
}
