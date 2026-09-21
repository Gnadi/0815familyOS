// A Google access token for a service account, signed here rather than by a
// library.
//
// Why this exists: a voice assistant calling in from outside the browser has
// no Firebase session, so the server has to write the family's documents
// itself. That needs Google credentials. `firebase-admin` would do it, at the
// cost of a ~30 MB dependency in every function bundle; the whole exchange is
// a signed JWT and one POST, and this file already has company (see
// _assistant/auth.js, which verifies Firebase ID tokens the same way).
//
// Configure with FIREBASE_SERVICE_ACCOUNT: the JSON from
// "Firebase console -> Project settings -> Service accounts -> Generate new
// private key", either raw or base64-encoded.

import { createSign } from 'crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/datastore';

// Google issues one-hour tokens; renew a minute early so a request never
// starts with a token that expires mid-flight.
const RENEW_MARGIN_S = 60;

let cached = { token: '', expiresAt: 0 };
let credentials = null;

export class ServiceAccountError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ServiceAccountError';
  }
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function serviceAccount(env = process.env) {
  if (credentials) return credentials;
  const raw = (env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (!raw) throw new ServiceAccountError('FIREBASE_SERVICE_ACCOUNT is not set.');

  let parsed;
  try {
    // Env-var UIs mangle multi-line values, so base64 is the safer shape to
    // paste; accept both.
    const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
    parsed = JSON.parse(json);
  } catch {
    throw new ServiceAccountError('FIREBASE_SERVICE_ACCOUNT is not valid JSON (or base64 of it).');
  }
  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new ServiceAccountError(
      'FIREBASE_SERVICE_ACCOUNT is missing client_email, private_key or project_id.',
    );
  }
  credentials = {
    clientEmail: parsed.client_email,
    // Newlines survive as literal "\n" through most env-var UIs.
    privateKey: parsed.private_key.replace(/\\n/g, '\n'),
    projectId: parsed.project_id,
  };
  return credentials;
}

// Exported for the unit test: the assertion is the only interesting part.
export function buildAssertion(account, now = Math.floor(Date.now() / 1000)) {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(
    JSON.stringify({
      iss: account.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = createSign('RSA-SHA256')
    .update(`${header}.${claims}`)
    .sign(account.privateKey)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${header}.${claims}.${signature}`;
}

export async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cached.token && cached.expiresAt - RENEW_MARGIN_S > now) return cached.token;

  const account = serviceAccount();
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: buildAssertion(account, now),
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.access_token) {
    const detail = json?.error_description || json?.error || `HTTP ${res.status}`;
    throw new ServiceAccountError(`Could not get a Google access token: ${detail}`);
  }
  cached = { token: json.access_token, expiresAt: now + (Number(json.expires_in) || 3600) };
  return cached.token;
}

export function hasServiceAccount(env = process.env) {
  return Boolean((env.FIREBASE_SERVICE_ACCOUNT || '').trim());
}

export function projectId(env = process.env) {
  const explicit = (env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || '').trim();
  if (explicit) return explicit;
  return serviceAccount(env).projectId;
}

// Test seam: the module caches both the parsed credentials and the token.
export function resetCredentialCache() {
  cached = { token: '', expiresAt: 0 };
  credentials = null;
}
