import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SITE_URL } from '../config/site';
import { generateInviteToken, isValidInviteToken } from '../utils/inviteToken';
import { isDemoMode } from '../lib/demoMode';
import { demoAdd, demoDocs, demoUpdate, demoDelete } from './demoStore';

// Invitations to join a family. The document ID is the token itself — see
// src/utils/inviteToken.js and the /invites rules in firestore.rules.
//
// There is deliberately no "list invites for this family" query: `list` is
// denied on this collection, because enumeration would hand out every family.
// The family document tracks its own live tokens in `activeInvites` instead
// (see services/families.js).

const DEFAULT_TTL_DAYS = 7;

export function inviteUrl(token) {
  return `${SITE_URL}/join/${token}`;
}

function expiryFromNow(ttlDays) {
  const days = Math.max(1, Math.min(30, Math.round(Number(ttlDays) || DEFAULT_TTL_DAYS)));
  const at = new Date();
  at.setDate(at.getDate() + days);
  return at;
}

function mapInvite(token, data) {
  if (!data) return null;
  return {
    token,
    familyId: data.familyId,
    familyName: data.familyName || '',
    createdBy: data.createdBy,
    createdByName: data.createdByName || '',
    revoked: Boolean(data.revoked),
    expiresAt: data.expiresAt?.toDate ? data.expiresAt.toDate() : data.expiresAt || null,
  };
}

export function isExpired(invite) {
  return Boolean(invite?.expiresAt) && invite.expiresAt.getTime() <= Date.now();
}

export async function createInvite({
  familyId,
  familyName,
  uid,
  displayName,
  ttlDays = DEFAULT_TTL_DAYS,
}) {
  const token = generateInviteToken();
  const expiresAt = expiryFromNow(ttlDays);
  const payload = {
    familyId,
    // Denormalized: once `get` on families is members-only, an invited
    // non-member cannot read the family document, so the join screen would
    // have nothing to show.
    familyName: familyName || '',
    createdBy: uid,
    createdByName: displayName || '',
    revoked: false,
    revokedAt: null,
  };

  if (isDemoMode()) {
    await demoAdd('invites', {
      ...payload,
      token,
      expiresAt,
      createdAt: new Date(),
    });
    return { token, url: inviteUrl(token), expiresAt };
  }

  // setDoc on a fresh id, never addDoc: the token is the id, and a create-only
  // write means a (vanishingly unlikely) collision can't overwrite someone
  // else's live invite.
  await setDoc(doc(db, 'invites', token), {
    ...payload,
    expiresAt: Timestamp.fromDate(expiresAt),
    createdAt: serverTimestamp(),
  });
  return { token, url: inviteUrl(token), expiresAt };
}

export async function readInvite(token) {
  if (!isValidInviteToken(token)) return null;
  if (isDemoMode()) {
    const found = demoDocs('invites').find((d) => d.data().token === token);
    return found ? mapInvite(token, found.data()) : null;
  }
  const snap = await getDoc(doc(db, 'invites', token));
  return snap.exists() ? mapInvite(token, snap.data()) : null;
}

export async function revokeInvite(token) {
  if (isDemoMode()) {
    const found = demoDocs('invites').find((d) => d.data().token === token);
    if (found) await demoUpdate('invites', found.id, { revoked: true, revokedAt: new Date() });
    return;
  }
  await updateDoc(doc(db, 'invites', token), {
    revoked: true,
    revokedAt: serverTimestamp(),
  });
}

export async function deleteInvite(token) {
  if (isDemoMode()) {
    const found = demoDocs('invites').find((d) => d.data().token === token);
    if (found) await demoDelete('invites', found.id);
    return;
  }
  await deleteDoc(doc(db, 'invites', token));
}
