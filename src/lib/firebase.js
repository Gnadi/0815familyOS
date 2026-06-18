import { initializeApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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
export const db = getFirestore(app);
export const auth = import.meta.env.SSR ? null : getAuth(app);
export const googleProvider = import.meta.env.SSR ? null : new GoogleAuthProvider();

if (!import.meta.env.SSR) {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    // Persistence failures are non-fatal; session simply won't survive reloads.
  });
}
