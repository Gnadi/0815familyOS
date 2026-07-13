// In-memory backing store for demo mode (see src/lib/demoMode.js). While the
// isDemo flag is set, every service in src/services/* routes reads and writes
// here instead of Firestore, so the demo is fully interactive without any
// Firebase project, auth provider, or network traffic. State lives only in
// this module — a reload re-seeds it from src/services/demoSeed.js.
//
// Reads are exposed as fake Firestore snapshots ({ id, data() }) so the
// services' existing snapshot mappers work verbatim; raw docs hold plain JS
// Dates, which the mappers' `value?.toDate ? … : value` guards pass through.
//
// IMPORTANT: this module must never import from ../lib/firebase.

import { buildSeed } from './demoSeed';

export const DEMO_UID = 'demo-user';
export const DEMO_FAMILY_ID = 'demo-family';

let state = null; // { collections: Map<name, Map<id, raw>>, family, userDoc }
const listeners = new Map(); // channel ('events', …, 'family', 'userDoc') -> Set<cb>

function ensure() {
  if (!state) state = buildSeed();
  return state;
}

function channel(name) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  return listeners.get(name);
}

function fakeDocs(name) {
  const col = ensure().collections.get(name) || new Map();
  return [...col.entries()].map(([id, raw]) => ({ id, data: () => raw }));
}

function notify(name) {
  const docs = fakeDocs(name);
  channel(name).forEach((cb) => cb(docs));
}

export function genId(prefix = 'demo') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// --- collections -----------------------------------------------------------

export function demoSubscribe(name, cb) {
  channel(name).add(cb);
  cb(fakeDocs(name));
  return () => channel(name).delete(cb);
}

export function demoDocs(name) {
  return fakeDocs(name);
}

export function demoAdd(name, raw) {
  const col = ensure().collections.get(name);
  const id = genId(name);
  col.set(id, { ...raw });
  notify(name);
  return Promise.resolve({ id });
}

export function demoUpdate(name, id, patch) {
  const col = ensure().collections.get(name);
  const existing = col.get(id);
  if (existing) {
    col.set(id, { ...existing, ...patch });
    notify(name);
  }
  return Promise.resolve();
}

export function demoDelete(name, id) {
  ensure().collections.get(name).delete(id);
  notify(name);
  return Promise.resolve();
}

// --- family ----------------------------------------------------------------

export function demoGetFamily() {
  return { id: DEMO_FAMILY_ID, ...ensure().family };
}

export function demoSubscribeFamily(cb) {
  channel('family').add(cb);
  cb(demoGetFamily());
  return () => channel('family').delete(cb);
}

export function demoUpdateFamily(patch) {
  const s = ensure();
  s.family = { ...s.family, ...patch };
  channel('family').forEach((cb) => cb(demoGetFamily()));
  return Promise.resolve();
}

// --- identity ---------------------------------------------------------------

// Minimal stand-in for the Firebase User object; downstream code only reads
// uid / displayName / email.
export function demoUser() {
  const { userDoc } = ensure();
  return { uid: DEMO_UID, displayName: userDoc.displayName, email: null };
}

export function demoUserDoc() {
  return { id: DEMO_UID, ...ensure().userDoc };
}

export function demoSubscribeUserDoc(cb) {
  channel('userDoc').add(cb);
  cb(demoUserDoc());
  return () => channel('userDoc').delete(cb);
}

export function demoUpdateUserDoc(patch) {
  const s = ensure();
  s.userDoc = { ...s.userDoc, ...patch };
  channel('userDoc').forEach((cb) => cb(demoUserDoc()));
  return Promise.resolve();
}
