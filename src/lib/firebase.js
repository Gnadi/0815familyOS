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
export const db = createDb();
export const auth = import.meta.env.SSR ? null : getAuth(app);
export const googleProvider = import.meta.env.SSR ? null : new GoogleAuthProvider();

if (!import.meta.env.SSR) {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    // Persistence failures are non-fatal; session simply won't survive reloads.
  });
}
