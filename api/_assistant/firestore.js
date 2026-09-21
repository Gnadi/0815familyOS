// The slice of the Firestore REST API this app's machine interface needs:
// read a document, create one, patch a field. Values travel in Firestore's
// typed JSON ({ stringValue }, { timestampValue }, …), so the two codecs below
// are the bulk of it.
//
// These calls carry a service-account token (see googleAuth.js), so
// firestore.rules do not apply to them. Every caller must therefore take
// familyId and userId from the pairing token's own document and never from the
// request body -- that is the single invariant keeping the voice interface
// inside one family.

import { accessToken, projectId } from './googleAuth.js';

const BASE = 'https://firestore.googleapis.com/v1';
const TIMEOUT_MS = 10_000;

export class FirestoreError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'FirestoreError';
    this.status = status || 0;
  }
}

// --- value codec --------------------------------------------------------------

export function toValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: value.length ? { values: value.map(toValue) } : {} };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: toFields(value) } };
  }
  throw new FirestoreError(`Cannot encode a value of type ${typeof value}.`);
}

export function toFields(object) {
  return Object.fromEntries(Object.entries(object).map(([k, v]) => [k, toValue(v)]));
}

export function fromValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return new Date(value.timestampValue);
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromValue);
  if ('mapValue' in value) return fromFields(value.mapValue.fields || {});
  // referenceValue, geoPointValue, bytesValue: this app stores none of them.
  return null;
}

export function fromFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, fromValue(v)]));
}

// --- requests -----------------------------------------------------------------

async function request(path, { method = 'GET', body, query = '' } = {}) {
  const token = await accessToken();
  const url = `${BASE}/projects/${projectId()}/databases/(default)/documents/${path}${query}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new FirestoreError(json?.error?.message || `HTTP ${res.status}`, res.status);
    }
    return json;
  } catch (err) {
    if (err?.name === 'AbortError') throw new FirestoreError('Firestore timed out.', 504);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// null when the document does not exist; anything else throws.
export async function getDocument(path) {
  try {
    const doc = await request(encodeURI(path));
    return { id: doc.name.split('/').pop(), ...fromFields(doc.fields) };
  } catch (err) {
    if (err instanceof FirestoreError && err.status === 404) return null;
    throw err;
  }
}

// Firestore mints the id, matching addDoc() on the client.
export async function createDocument(collection, data) {
  const doc = await request(encodeURI(collection), {
    method: 'POST',
    body: { fields: toFields(data) },
  });
  return doc.name.split('/').pop();
}

export async function patchDocument(path, data) {
  const mask = Object.keys(data)
    .map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`)
    .join('&');
  await request(encodeURI(path), {
    method: 'PATCH',
    query: `?${mask}`,
    body: { fields: toFields(data) },
  });
}
