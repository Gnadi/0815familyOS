// Pairing tokens: the credential a chatbot or a phone shortcut uses to add
// entries to this family (see api/_assistant/pairing.js for the other side).
//
// The document ID *is* the token, exactly like an invite link, so it is a
// 128-bit CSPRNG value and cannot be enumerated. Unlike invites, `list` is
// allowed for members of the owning family — the settings screen has to be
// able to show and revoke what it handed out.

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SITE_URL } from '../config/site';
// Same requirements as an invite token: unguessable, URL-safe, and a legal
// Firestore document id.
import { generateInviteToken } from '../utils/inviteToken';

const tokensRef = collection(db, 'agentTokens');

export const MAX_LABEL_CHARS = 60;

// What the family pastes into the chatbot or shortcut.
export function mcpUrl(token) {
  return `${SITE_URL}/api/mcp?token=${token}`;
}

export function restUrl() {
  return `${SITE_URL}/api/agent`;
}

export function openApiUrl() {
  return `${SITE_URL}/api/openapi`;
}

function toDate(value) {
  if (!value) return null;
  return value?.toDate ? value.toDate() : value;
}

export async function createAgentToken({ familyId, userId, label, locale }) {
  const token = generateInviteToken();
  await setDoc(doc(db, 'agentTokens', token), {
    familyId,
    userId,
    label: String(label || '').trim().slice(0, MAX_LABEL_CHARS),
    // The server answers in this language, so a spoken confirmation needs no
    // configuration on the caller's side.
    locale: locale === 'de' ? 'de' : 'en',
    revoked: false,
    createdAt: serverTimestamp(),
    lastUsedAt: null,
    useCount: 0,
  });
  return token;
}

export async function listAgentTokens(familyId) {
  const snap = await getDocs(query(tokensRef, where('familyId', '==', familyId)));
  return snap.docs
    .map((d) => ({
      token: d.id,
      ...d.data(),
      createdAt: toDate(d.data().createdAt),
      lastUsedAt: toDate(d.data().lastUsedAt),
    }))
    .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
}

export function revokeAgentToken(token) {
  return updateDoc(doc(db, 'agentTokens', token), {
    revoked: true,
    revokedAt: serverTimestamp(),
  });
}

export function deleteAgentToken(token) {
  return deleteDoc(doc(db, 'agentTokens', token));
}
