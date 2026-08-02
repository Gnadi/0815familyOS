import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { isDemoMode } from '../lib/demoMode';

export const AuthContext = createContext({
  user: null,
  userDoc: null,
  family: null,
  encryptionKey: null,
  loading: true,
  isDemo: false,
  signOut: () => {},
});

// Firebase (auth + firestore) is imported lazily inside effects/handlers rather
// than at module scope. This keeps the ~200 KB Firebase SDK out of the initial
// JS chunk that loads on the pre-rendered marketing landing page — it is
// fetched right after hydration instead. Logged-out visitors (the common case
// for the landing page) never block on it, which meaningfully improves LCP/FCP.
// Behaviour is otherwise identical to a static import; ES modules are
// singletons, so lib/firebase initializes exactly once no matter how many
// effects import it.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [family, setFamily] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [loading, setLoading] = useState(true);
  // Stable for the lifetime of the page: entering/leaving the demo is always
  // a hard navigation (see lib/demoMode.js), so the provider initializes down
  // exactly one path per load and never has to tear listeners across modes.
  const demo = isDemoMode();

  useEffect(() => {
    // Demo: fabricate the signed-in user from the demo store and never touch
    // Firebase Auth — no listener attached, no network. Everything downstream
    // (userDoc, family, data hooks) routes through the demo-aware services.
    if (demo) {
      let cancelled = false;
      (async () => {
        const { demoUser } = await import('../services/demoStore');
        if (!cancelled) setUser(demoUser());
      })();
      return () => {
        cancelled = true;
      };
    }
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      const [{ onAuthStateChanged }, { auth }, { ensureUserDoc }] = await Promise.all([
        import('firebase/auth'),
        import('../lib/firebase'),
        import('../services/users'),
      ]);
      if (cancelled) return;
      // No usable Firebase config: stay signed-out rather than crashing. The
      // landing/legal pages and the offline demo remain fully usable.
      if (!auth) {
        setUser(null);
        setLoading(false);
        return;
      }
      unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        if (!u) {
          setUserDoc(null);
          setFamily(null);
          setEncryptionKey(null);
          setLoading(false);
        } else {
          ensureUserDoc(u).catch(console.error);
        }
      });
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [demo]);

  useEffect(() => {
    if (!user) return undefined;
    setLoading(true);
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      if (demo) {
        const { demoSubscribeUserDoc } = await import('../services/demoStore');
        if (cancelled) return;
        unsub = demoSubscribeUserDoc((d) => {
          setUserDoc(d);
          setLoading(false);
        });
        return;
      }
      const { subscribeUserDoc } = await import('../services/users');
      if (cancelled) return;
      unsub = subscribeUserDoc(user.uid, (d) => {
        setUserDoc(d);
        setLoading(false);
      });
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [user, demo]);

  useEffect(() => {
    if (!userDoc?.familyId) {
      setFamily(null);
      return undefined;
    }
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      const { subscribeFamily } = await import('../services/families');
      if (cancelled) return;
      unsub = subscribeFamily(userDoc.familyId, setFamily);
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [userDoc?.familyId]);

  useEffect(() => {
    if (!family) {
      setEncryptionKey(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const { generateEncryptionKey, importEncryptionKey } = await import(
        '../utils/encryption'
      );
      if (cancelled) return;
      if (family.encryptionKeyJwk) {
        const key = await importEncryptionKey(family.encryptionKeyJwk);
        if (!cancelled) setEncryptionKey(key);
      } else {
        // Existing family without a key — generate one silently.
        const { key, jwk } = await generateEncryptionKey();
        const [{ doc, updateDoc }, { db }] = await Promise.all([
          import('firebase/firestore'),
          import('../lib/firebase'),
        ]);
        if (cancelled) return;
        updateDoc(doc(db, 'families', family.id), { encryptionKeyJwk: jwk });
        setEncryptionKey(key);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [family?.id, family?.encryptionKeyJwk]);

  const signOut = useCallback(async () => {
    const { signOut: fbSignOut } = await import('../services/auth');
    return fbSignOut();
  }, []);

  const value = useMemo(
    () => ({ user, userDoc, family, encryptionKey, loading, isDemo: demo, signOut }),
    [user, userDoc, family, encryptionKey, loading, demo, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
