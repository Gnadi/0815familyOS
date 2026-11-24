import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isDemoMode } from '../lib/demoMode';
import { demoMembers } from '../services/demoStore';
import useAuth from './useAuth';

// Member profiles, cached per uid for the whole session.
//
// Every caller used to run one getDoc per member on each mount: the Dashboard
// alone did it twice, and every form modal again on each open. Names change
// rarely, so a cached profile is served immediately and refreshed in the
// background once it is older than REFRESH_MS.
const REFRESH_MS = 5 * 60 * 1000;
const profiles = new Map(); // uid -> { member: {uid, displayName} | null, at }
const inflight = new Map(); // uid -> Promise

function toMember(snap) {
  if (!snap.exists()) return null;
  const data = snap.data();
  return { uid: snap.id, displayName: data.displayName || data.email || 'Member' };
}

function fetchProfile(uid) {
  if (inflight.has(uid)) return inflight.get(uid);
  const p = getDoc(doc(db, 'users', uid))
    .then((snap) => {
      const member = toMember(snap);
      profiles.set(uid, { member, at: Date.now() });
      return member;
    })
    .catch(() => {
      // Keep whatever we had; a transient failure should not blank names.
      const cached = profiles.get(uid);
      return cached ? cached.member : null;
    })
    .finally(() => inflight.delete(uid));
  inflight.set(uid, p);
  return p;
}

function fromCache(ids) {
  if (!ids.every((uid) => profiles.has(uid))) return null;
  return ids.map((uid) => profiles.get(uid).member).filter(Boolean);
}

export default function useFamilyMembers() {
  const { family } = useAuth();
  const key = (family?.memberIds || []).join(',');
  const ids = useMemo(() => (key ? key.split(',') : []), [key]);

  const [members, setMembers] = useState(() => {
    if (!ids.length) return [];
    if (isDemoMode()) return demoMembers();
    return fromCache(ids) || [];
  });

  useEffect(() => {
    if (!ids.length) {
      setMembers([]);
      return undefined;
    }
    // Demo: members come from the seed — no Firestore lookup.
    if (isDemoMode()) {
      setMembers(demoMembers());
      return undefined;
    }
    let cancelled = false;
    const cached = fromCache(ids);
    if (cached) setMembers((prev) => (sameMembers(prev, cached) ? prev : cached));

    const now = Date.now();
    const stale = ids.some((uid) => !profiles.has(uid) || now - profiles.get(uid).at > REFRESH_MS);
    if (!stale && cached) return undefined;

    Promise.all(ids.map((uid) => {
      const hit = profiles.get(uid);
      return hit && now - hit.at <= REFRESH_MS ? hit.member : fetchProfile(uid);
    })).then((list) => {
      if (cancelled) return;
      const next = list.filter(Boolean);
      setMembers((prev) => (sameMembers(prev, next) ? prev : next));
    });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return members;
}

function sameMembers(a, b) {
  if (a.length !== b.length) return false;
  return a.every((m, i) => m.uid === b[i].uid && m.displayName === b[i].displayName);
}

// Test helper.
export function _resetMemberCache() {
  profiles.clear();
  inflight.clear();
}
