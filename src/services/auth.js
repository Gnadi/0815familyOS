import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider, requireAuth } from '../lib/firebase';
import { ensureUserDoc } from './users';
import { exitDemo, isDemoMode } from '../lib/demoMode';
import { clearAuthHint } from '../lib/authHint';

// Firebase auth error codes mapped to i18n keys (authErrors.*). Callers pass a
// `t` function so messages render in the active language; without one we fall
// back to the English source strings.
const codeKeys = {
  'auth/invalid-email': 'authErrors.invalidEmail',
  'auth/email-already-in-use': 'authErrors.emailInUse',
  'auth/weak-password': 'authErrors.weakPassword',
  'auth/wrong-password': 'authErrors.wrongCredentials',
  'auth/user-not-found': 'authErrors.wrongCredentials',
  'auth/invalid-credential': 'authErrors.wrongCredentials',
  'auth/too-many-requests': 'authErrors.tooManyRequests',
  'auth/popup-closed-by-user': 'authErrors.popupClosed',
  'auth/network-request-failed': 'authErrors.network',
};

const friendlyEn = {
  'authErrors.generic': 'Something went wrong.',
  'authErrors.invalidEmail': 'That email address looks invalid.',
  'authErrors.emailInUse': 'An account with that email already exists.',
  'authErrors.weakPassword': 'Password must be at least 6 characters.',
  'authErrors.wrongCredentials': 'Incorrect email or password.',
  'authErrors.tooManyRequests': 'Too many attempts — please try again in a minute.',
  'authErrors.popupClosed': 'Google sign-in was cancelled.',
  'authErrors.network': 'Network error. Check your connection.',
};

export function toFriendlyError(err, t) {
  const tr = t || ((key) => friendlyEn[key] || key);
  if (!err) return tr('authErrors.generic');
  const key = codeKeys[err.code];
  if (key) return tr(key);
  return err.message || tr('authErrors.generic');
}

export async function signUpWithEmail({ email, password, displayName }) {
  const cred = await createUserWithEmailAndPassword(requireAuth(), email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  await ensureUserDoc(cred.user, { displayName });
  return cred.user;
}

export async function signInWithEmail({ email, password }) {
  const cred = await signInWithEmailAndPassword(requireAuth(), email, password);
  await ensureUserDoc(cred.user);
  return cred.user;
}

export async function signInWithGoogle() {
  const cred = await signInWithPopup(requireAuth(), googleProvider);
  await ensureUserDoc(cred.user);
  return cred.user;
}

export function signOut() {
  // Signing out of the demo simply leaves it (hard navigation back to the
  // landing page); there is no Firebase session to clear.
  if (isDemoMode()) {
    exitDemo('/');
    return Promise.resolve();
  }
  // Drop the "signed in" breadcrumb synchronously: the auth listener clears it
  // too, but a redirect to "/" can win that race and would bounce the user
  // straight back into the app.
  clearAuthHint();
  if (!auth) return Promise.resolve();
  return fbSignOut(auth);
}
