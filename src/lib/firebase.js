import { initializeApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

const app = initializeApp(config);

// Firestore can be created in Node: getFirestore() and the module-level
// collection() refs in src/services/* are inert (no network, no browser APIs)
// until a service is actually called from a client effect/handler. Auth,
// however, eagerly validates the API key / touches browser storage, so it is
// only initialized on the client. It is exclusively used inside effects and
// handlers, so the null SSR fallbacks are never dereferenced during the build.
//
// In the browser, Firestore runs with a persistent (IndexedDB) local cache so
// the app keeps working offline: listeners serve cached data instantly and
// writes queue until the connection returns. The multi-tab manager keeps the
// cache consistent when the app is open in several tabs. During SSG (Node)
// there is no IndexedDB, so the default in-memory instance is used instead.
function createDb() {
  if (import.meta.env.SSR) return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // e.g. IndexedDB unavailable (old private-browsing modes) — fall back to
    // the default in-memory cache rather than breaking the app.
    return getFirestore(app);
  }
}
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

export const db = createDb();
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

if (auth) {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    // Persistence failures are non-fatal; session simply won't survive reloads.
  });
}
