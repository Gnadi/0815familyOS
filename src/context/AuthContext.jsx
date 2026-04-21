import { createContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { subscribeUserDoc } from '../services/users';
import { subscribeFamily } from '../services/families';
import { signOut as fbSignOut } from '../services/auth';

export const AuthContext = createContext({
  user: null,
  userDoc: null,
  family: null,
  loading: true,
  signOut: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setUserDoc(null);
        setFamily(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    setLoading(true);
    const unsub = subscribeUserDoc(user.uid, (doc) => {
      setUserDoc(doc);
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

  const value = useMemo(
    () => ({ user, userDoc, family, loading, signOut: fbSignOut }),
    [user, userDoc, family, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
