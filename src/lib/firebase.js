// Firestore on top of the shared app/auth from ./firebaseApp. Everything that
// module exports is re-exported here, so `import { auth, db } from
// '../lib/firebase'` keeps working. Code that needs auth only should import
// ./firebaseApp directly to stay off the Firestore chunk.
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { app } from './firebaseApp';

export {
  app,
  auth,
  authorizationHeader,
  firebaseConfigured,
  googleProvider,
  requireAuth,
} from './firebaseApp';

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
