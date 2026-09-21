// Pairing tokens: how a voice assistant proves it may add to one family's
// calendar.
//
// A browser sends a Firebase ID token (see auth.js), but Gemini, ChatGPT, a
// Siri Shortcut or an automation service has no session to speak of. So the
// app mints a long random token, the family pastes it into that service once,
// and it arrives here on every call. The token IS the document id in
// `agentTokens` -- the same shape the invite links use (src/utils/inviteToken.js)
// -- so it is 128 bits of CSPRNG, unguessable and not enumerable.
//
// What a token can do is deliberately narrow: create an event, a task or a
// shopping item in the one family it was minted for. It cannot read anything,
// change anything or delete anything, because nothing here offers that.

import { getDocument, patchDocument } from './firestore.js';

// Kept in step with INVITE_TOKEN_RE in src/utils/inviteToken.js and with the
// /agentTokens rule in firestore.rules. The check matters before the value is
// interpolated into a document path.
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export class PairingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PairingError';
  }
}

// Three places a caller may carry the token, because automation services
// differ in what they can send: a header is preferred, a query parameter is
// the only option in some shortcut editors.
export function tokenFrom(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const bearer = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  if (bearer) return bearer[1].trim();
  const custom = req.headers?.['x-faos-token'];
  if (custom) return String(custom).trim();
  const query = req.query?.token;
  if (query) return String(query).trim();
  return '';
}

export async function resolvePairing(rawToken) {
  const token = String(rawToken || '').trim();
  if (!token) throw new PairingError('No pairing token. Send it as "Authorization: Bearer <token>".');
  if (!TOKEN_RE.test(token)) throw new PairingError('Malformed pairing token.');

  const doc = await getDocument(`agentTokens/${token}`);
  if (!doc) throw new PairingError('Unknown pairing token. Create a new one in myFAOS settings.');
  if (doc.revoked) throw new PairingError('This pairing token was revoked.');
  if (!doc.familyId || !doc.userId) throw new PairingError('This pairing token is incomplete.');

  return {
    token,
    familyId: doc.familyId,
    userId: doc.userId,
    // The app stores its UI language on the token, so a spoken confirmation
    // comes back in the right language without the caller configuring anything.
    locale: doc.locale === 'de' ? 'de' : 'en',
    label: doc.label || '',
    useCount: Number(doc.useCount) || 0,
  };
}

// "Last used" is what turns "did my shortcut actually reach the app?" into a
// glance at the settings screen. Best-effort: a failed bookkeeping write must
// not fail an entry the family asked for.
export async function touchPairing(token, useCount = 0) {
  try {
    await patchDocument(`agentTokens/${token}`, {
      lastUsedAt: new Date(),
      useCount: Number(useCount) + 1,
    });
  } catch {
    // Ignored on purpose.
  }
}
