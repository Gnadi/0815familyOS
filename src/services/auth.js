import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  OAuthProvider,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider, appleProvider } from '../lib/firebase';
import { isIOS } from '../lib/platform';
import { ensureUserDoc } from './users';

const friendly = {
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/email-already-in-use': 'An account with that email already exists.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts — please try again in a minute.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/network-request-failed': 'Network error. Check your connection.',
};

export function toFriendlyError(err) {
  if (!err) return 'Something went wrong.';
  return friendly[err.code] || err.message || 'Something went wrong.';
}

export async function signUpWithEmail({ email, password, displayName }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  await ensureUserDoc(cred.user, { displayName });
  return cred.user;
}

export async function signInWithEmail({ email, password }) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserDoc(cred.user);
  return cred.user;
}

export async function signInWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  await ensureUserDoc(cred.user);
  return cred.user;
}

export async function signInWithApple() {
  if (isIOS) {
    const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
    const nonce = cryptoRandomString();
    const options = {
      clientId: 'com.familyos.app',
      redirectURI: `https://${import.meta.env.VITE_FIREBASE_AUTH_DOMAIN}/__/auth/handler`,
      scopes: 'email name',
      nonce,
    };
    const result = await SignInWithApple.authorize(options);
    const idToken = result?.response?.identityToken;
    if (!idToken) throw new Error('Apple sign-in did not return an identity token.');
    const credential = new OAuthProvider('apple.com').credential({
      idToken,
      rawNonce: nonce,
    });
    const fbCred = await signInWithCredential(auth, credential);
    const fullName = [result?.response?.givenName, result?.response?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (fullName && !fbCred.user.displayName) {
      await updateProfile(fbCred.user, { displayName: fullName });
    }
    await ensureUserDoc(fbCred.user, fullName ? { displayName: fullName } : undefined);
    return fbCred.user;
  }
  const cred = await signInWithPopup(auth, appleProvider);
  await ensureUserDoc(cred.user);
  return cred.user;
}

export function signOut() {
  return fbSignOut(auth);
}

function cryptoRandomString() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
