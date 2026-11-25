// Firebase app + Auth only, without Firestore.
//
// Split from lib/firebase.js so the code that only needs to know *who* is
// signed in (AuthProvider on the public pages, the auth-header helper) does not
// drag in the Firestore SDK -- the largest chunk of the bundle. lib/firebase.js
// re-exports everything here and adds `db`; existing imports keep working.
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
} from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

export const app = initializeApp(config);

// getAuth() throws synchronously on a missing/invalid API key. Left unguarded
// that takes this whole module down, and with it every src/services/* module
// that imports `db` — including the ones demo mode relies on, even though the
// demo never talks to Firebase at all. So auth stays optional: without a valid
// config `auth` is null, the app behaves as signed-out, and the landing page,
// legal pages and the offline demo keep working. Callers that genuinely need
// auth check `firebaseConfigured` / `requireAuth()`.
function createAuth() {
  if (import.meta.env.SSR || !firebaseConfigured) return null;
  try {
    return getAuth(app);
  } catch (err) {
    console.error('Firebase Auth could not be initialized:', err);
    return null;
  }
}

export const auth = createAuth();
export const googleProvider = auth ? new GoogleAuthProvider() : null;

// Throws a message a human can act on, instead of letting an undefined `auth`
// surface as a cryptic SDK error deep inside a sign-in flow.
export function requireAuth() {
  if (!auth) {
    throw new Error(
      'Firebase is not configured. Add the VITE_FIREBASE_* values from .env.example to your .env.',
    );
  }
  return auth;
}

// The signed-in user's ID token, as the header the endpoints in api/ ask for:
// they answer only members of a family (api/_lib/familyMember.js).
export async function authorizationHeader() {
  const user = auth?.currentUser;
  if (!user) throw new Error('Sign in first.');
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

if (auth) {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    // Persistence failures are non-fatal; session simply won't survive reloads.
  });
}
