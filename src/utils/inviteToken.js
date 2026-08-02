// Invite tokens. The token IS the access secret and also the Firestore
// document ID of the invite, so it has to be unguessable, URL-safe and a legal
// document ID (A-Za-z0-9-_ only; never "." or "..").
//
// This replaces the old 6-character invite code, which drew from Math.random()
// for ~30 bits of entropy. V8's xorshift128+ state is recoverable from a
// handful of outputs, so codes minted around the same time were predictable —
// and 32^6 is small enough to grind through anyway.

// 16 bytes = 128 bits, base64url-encoded to 22 characters.
const TOKEN_BYTES = 16;

// Also enforced in firestore.rules before the token is interpolated into a
// document path — keep the two in sync.
export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateInviteToken() {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

// People paste whole links, not bare tokens. Accept either, plus stray
// whitespace, and reduce to the last path segment.
export function normalizeInviteToken(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const withoutQuery = trimmed.split(/[?#]/)[0];
  const segments = withoutQuery.split('/').filter(Boolean);
  return segments.length ? segments[segments.length - 1] : '';
}

export function isValidInviteToken(token) {
  return INVITE_TOKEN_RE.test(token || '');
}

// The old codes were 6 characters from an uppercase/digit alphabet. Detecting
// them lets the UI say "this code no longer works" instead of "not found".
export function looksLikeLegacyCode(raw) {
  return /^[A-Z0-9]{6}$/.test(String(raw || '').trim().toUpperCase());
}
