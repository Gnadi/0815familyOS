import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isDemoMode } from '../lib/demoMode';
import { demoMembers } from '../services/demoStore';
import useAuth from './useAuth';

export default function useFamilyMembers() {
  const { family } = useAuth();
  const [members, setMembers] = useState([]);

  useEffect(() => {
    const ids = family?.memberIds || [];
    if (!ids.length) {
      setMembers([]);
      return;
    }
    // Demo: members come from the seed — no Firestore lookup.
    if (isDemoMode()) {
      setMembers(demoMembers());
      return;
    }
    Promise.all(ids.map((uid) => getDoc(doc(db, 'users', uid)))).then((snaps) => {
      setMembers(
        snaps
          .filter((s) => s.exists())
          .map((s) => ({ uid: s.id, displayName: s.data().displayName || s.data().email || 'Member' }))
      );
    });
  }, [(family?.memberIds || []).join(',')]);

  return members;
}
