import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider, requireAuth } from '../lib/firebase';
import { ensureUserDoc } from './users';
import { exitDemo, isDemoMode } from '../lib/demoMode';
import { clearAuthHint } from '../lib/authHint';
import { normalizeDisplayName } from '../utils/displayName';

// Firebase auth error codes mapped to i18n keys (authErrors.*). Callers pass a
// `t` function so messages render in the active language; without one we fall
// back to the English source strings.
const codeKeys = {
  'auth/invalid-email': 'authErrors.invalidEmail',
  'auth/missing-email': 'authErrors.invalidEmail',
  'auth/email-already-in-use': 'authErrors.emailInUse',
  'auth/weak-password': 'authErrors.weakPassword',
  'auth/wrong-password': 'authErrors.wrongCredentials',
  'auth/user-not-found': 'authErrors.wrongCredentials',
  'auth/invalid-credential': 'authErrors.wrongCredentials',
  'auth/too-many-requests': 'authErrors.tooManyRequests',
  'auth/popup-closed-by-user': 'authErrors.popupClosed',
  'auth/network-request-failed': 'authErrors.network',
  'auth/wrong-current-password': 'authErrors.wrongCurrentPassword',
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
  'authErrors.wrongCurrentPassword': 'Your current password is incorrect.',
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
  // Same normalization the rename in settings applies, so a name written at
  // signup and one written later are stored in the same shape.
  const name = normalizeDisplayName(displayName);
  if (name) {
    await updateProfile(cred.user, { displayName: name });
  }
  await ensureUserDoc(cred.user, { displayName: name });
  return cred.user;
}

export async function signInWithEmail({ email, password }) {
  const cred = await signInWithEmailAndPassword(requireAuth(), email, password);
  await ensureUserDoc(cred.user);
  return cred.user;
}

// Sends Firebase's password-reset email. The link opens Firebase's hosted
// action page; after the new password is set it offers a "continue" button
// back to our /login. `locale` localizes the email itself.
//
// With email enumeration protection (the Firebase default) this resolves even
// for addresses without an account, so callers must show a neutral message.
export async function requestPasswordReset({ email, locale }) {
  const a = requireAuth();
  if (locale) a.languageCode = locale;
  const settings = { url: `${window.location.origin}/login` };
  try {
    await sendPasswordResetEmail(a, email, settings);
  } catch (err) {
    // The continue URL must be an authorized domain in the Firebase console
    // (often not the case for preview deployments). The reset itself still
    // works without it, so retry rather than fail the whole request.
    if (err?.code !== 'auth/unauthorized-continue-uri') throw err;
    await sendPasswordResetEmail(a, email);
  }
}

// True when the account can sign in with a password (as opposed to Google
// only) — the only accounts that have a password to change.
export function hasPasswordLogin(user) {
  return Boolean(user?.providerData?.some((p) => p.providerId === 'password'));
}

// Firebase only lets a password change through right after a sign-in, so the
// current password is re-checked first. That also keeps someone at an
// unattended, signed-in device from silently taking over the account.
export async function changePassword({ currentPassword, newPassword }) {
  const user = requireAuth().currentUser;
  if (!user?.email) throw new Error('Not signed in.');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  try {
    await reauthenticateWithCredential(user, credential);
  } catch (err) {
    // With the email fixed, a credential error can only mean the current
    // password; say so instead of the login's "email or password" message.
    if (['auth/wrong-password', 'auth/invalid-credential'].includes(err?.code)) {
      const wrong = new Error('Current password is incorrect.');
      wrong.code = 'auth/wrong-current-password';
      throw wrong;
    }
    throw err;
  }
  await updatePassword(user, newPassword);
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
