import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { isDemoMode } from '../lib/demoMode';
import { demoUpdateUserDoc } from './demoStore';
import { normalizeDisplayName } from '../utils/displayName';

export async function ensureUserDoc(user, extras = {}) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email,
      displayName:
        normalizeDisplayName(extras.displayName) ||
        normalizeDisplayName(user.displayName) ||
        user.email?.split('@')[0] ||
        'User',
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
  if (isDemoMode()) return demoUpdateUserDoc(patch);
  return updateDoc(doc(db, 'users', uid), patch);
}

// Rename the signed-in user.
//
// The name lives in two places: the user document (what the app reads
// everywhere) and the Firebase Auth profile (the fallback shown before that
// document arrives, and what ensureUserDoc seeds from on a fresh device). Both
// are written so they cannot drift apart. Demo sessions only have the former —
// there is no Firebase user behind them.
export async function updateDisplayName(uid, name) {
  const displayName = normalizeDisplayName(name);
  if (!displayName) throw new Error('Display name must not be empty.');
  await updateUserDoc(uid, { displayName });
  if (!isDemoMode() && auth?.currentUser) {
    await updateProfile(auth.currentUser, { displayName });
  }
  return displayName;
}
