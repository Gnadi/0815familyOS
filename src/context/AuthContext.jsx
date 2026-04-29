import { createContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { subscribeUserDoc } from '../services/users';
import { subscribeFamily } from '../services/families';
import { signOut as fbSignOut } from '../services/auth';
import { generateEncryptionKey, importEncryptionKey } from '../utils/encryption';

export const AuthContext = createContext({
  user: null,
  userDoc: null,
  family: null,
  encryptionKey: null,
  loading: true,
  signOut: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [family, setFamily] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setUserDoc(null);
        setFamily(null);
        setEncryptionKey(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    setLoading(true);
    const unsub = subscribeUserDoc(user.uid, (d) => {
      setUserDoc(d);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!userDoc?.familyId) {
      setFamily(null);
      return undefined;
    }
    const unsub = subscribeFamily(userDoc.familyId, setFamily);
    return unsub;
  }, [userDoc?.familyId]);

  useEffect(() => {
    if (!family) { setEncryptionKey(null); return; }
    if (family.encryptionKeyJwk) {
      importEncryptionKey(family.encryptionKeyJwk).then(setEncryptionKey);
    } else {
      // Existing family without a key — generate one silently
      generateEncryptionKey().then(({ key, jwk }) => {
        updateDoc(doc(db, 'families', family.id), { encryptionKeyJwk: jwk });
        setEncryptionKey(key);
      });
    }
  }, [family?.id, family?.encryptionKeyJwk]);

  const value = useMemo(
    () => ({ user, userDoc, family, encryptionKey, loading, signOut: fbSignOut }),
    [user, userDoc, family, encryptionKey, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
