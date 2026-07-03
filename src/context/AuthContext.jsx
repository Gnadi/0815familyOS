import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

export const AuthContext = createContext({
  user: null,
  userDoc: null,
  family: null,
  encryptionKey: null,
  loading: true,
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

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      const [{ onAuthStateChanged }, { auth }, { ensureUserDoc }] = await Promise.all([
        import('firebase/auth'),
        import('../lib/firebase'),
        import('../services/users'),
      ]);
      if (cancelled) return;
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
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    setLoading(true);
    let unsub = () => {};
    let cancelled = false;
    (async () => {
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
  }, [user]);

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
    () => ({ user, userDoc, family, encryptionKey, loading, signOut }),
    [user, userDoc, family, encryptionKey, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
