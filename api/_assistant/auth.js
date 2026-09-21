// Who is allowed to spend the family's LLM budget.
//
// The endpoint costs money per call, so it cannot be open to the internet. The
// caller sends the Firebase ID token the app already holds, and this verifies
// it the same way firebase-admin would -- RS256 against Google's published
// signing certificates -- without pulling in the Admin SDK (and without a
// service-account key, which a static Vercel deployment has no good place for).
//
// Verified: signature, key id, issuer, audience, expiry, subject. That is what
// makes a token proof of a signed-in user of *this* Firebase project.

import { createVerify } from 'crypto';

const CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

// Google rotates these roughly daily and sends a max-age; an hour is well
// inside that and keeps a warm function from re-fetching per request.
const CERT_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_S = 60;

let cache = { fetchedAt: 0, certs: null };

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

async function signingCerts() {
  if (cache.certs && Date.now() - cache.fetchedAt < CERT_TTL_MS) return cache.certs;
  const res = await fetch(CERT_URL);
  if (!res.ok) throw new AuthError('Could not fetch Google signing certificates.');
  const certs = await res.json();
  cache = { fetchedAt: Date.now(), certs };
  return certs;
}

function fromBase64Url(segment) {
  return Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function decodeJson(segment) {
  try {
    return JSON.parse(fromBase64Url(segment).toString('utf8'));
  } catch {
    throw new AuthError('Malformed token.');
  }
}

export function bearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  return match ? match[1].trim() : '';
}

export async function verifyFirebaseIdToken(token, projectId) {
  if (!token) throw new AuthError('Missing ID token.');
  if (!projectId) throw new AuthError('Server is missing FIREBASE_PROJECT_ID.');

  const [rawHeader, rawPayload, rawSignature] = token.split('.');
  if (!rawHeader || !rawPayload || !rawSignature) throw new AuthError('Malformed token.');

  const header = decodeJson(rawHeader);
  if (header.alg !== 'RS256') throw new AuthError('Unexpected token algorithm.');
  if (!header.kid) throw new AuthError('Token has no key id.');

  const certs = await signingCerts();
  const cert = certs[header.kid];
  if (!cert) throw new AuthError('Token signed with an unknown key.');

  const signed = createVerify('RSA-SHA256')
    .update(`${rawHeader}.${rawPayload}`)
    .verify(cert, fromBase64Url(rawSignature));
  if (!signed) throw new AuthError('Token signature does not verify.');

  const payload = decodeJson(rawPayload);
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw new AuthError('Token was issued for another project.');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new AuthError('Unexpected token issuer.');
  }
  if (!payload.sub || typeof payload.sub !== 'string') throw new AuthError('Token has no subject.');
  if (Number(payload.exp) + CLOCK_SKEW_S < now) throw new AuthError('Token has expired.');
  if (Number(payload.iat) - CLOCK_SKEW_S > now) throw new AuthError('Token is not valid yet.');

  return { uid: payload.sub };
}

// Best-effort abuse brake. A serverless function has no shared memory, so this
// only limits bursts that land on the same warm instance -- enough to stop a
// stuck client hammering the provider, not a substitute for a real quota. The
// hard ceiling stays the spend limit on the provider's own API key.
const WINDOW_MS = 5 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits = new Map();

export function rateLimit(key, now = Date.now()) {
  const recent = (hits.get(key) || []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep the map from growing without bound on a long-lived instance.
  if (hits.size > 500) {
    for (const [k, times] of hits) {
      if (!times.some((at) => now - at < WINDOW_MS)) hits.delete(k);
    }
  }
  return true;
}
