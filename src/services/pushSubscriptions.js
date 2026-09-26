// Web Push: this device's subscription, stored where the reminder sender
// (scripts/send-reminders.mjs, run by GitHub Actions) can find it.
//
//   users/{uid}/pushSubscriptions/{id}
//     { endpoint, keys: { p256dh, auth }, timeZone, locale, userAgent,
//       updatedAt, sent: { [reminderId]: expiresAtMs } }
//
// The id is derived from the endpoint, so re-subscribing the same device
// overwrites its document instead of piling up copies. `timeZone` and `locale`
// let the sender compute "08:00" and write the text the way this device would.
//
// `sent` is this device's record of reminders it has already shown, written
// by both sides: the sender after a push, the app after showing one itself
// while open. Keeping it per device means a reminder shown on the laptop is
// still pushed to the phone.

import { deleteDoc, doc, FieldPath, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getStoredPushSubscriptionId, setStoredPushSubscriptionId } from '../lib/notifications';

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// Whether this build and this browser can receive pushes at all. Without the
// public key the app still reminds while it is open.
export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    Boolean(VAPID_PUBLIC_KEY) &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

function subscriptionRef(uid, id) {
  return doc(db, 'users', uid, 'pushSubscriptions', id);
}

function base64UrlToBytes(value) {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function idForEndpoint(endpoint) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(hash).slice(0, 20), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function registration() {
  // getRegistration() instead of .ready: .ready never settles when no worker
  // is registered (vite dev), and this runs from a fire-and-forget effect.
  return (await navigator.serviceWorker.getRegistration()) || null;
}

// Subscribes this device (reusing an existing subscription) and stores it for
// `uid`. Returns the subscription's document id, or null when there is no
// service worker to subscribe with.
export async function syncPushSubscription(uid, { locale } = {}) {
  const reg = await registration();
  if (!reg) return null;
  const subscription =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
    }));
  const { endpoint, keys } = subscription.toJSON();
  const id = await idForEndpoint(endpoint);
  // merge: keeps the `sent` record the sender has been writing.
  await setDoc(
    subscriptionRef(uid, id),
    {
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      locale: locale || null,
      userAgent: navigator.userAgent.slice(0, 200),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  setStoredPushSubscriptionId(id);
  return id;
}

// Stops pushes to this device for `uid`: the stored document goes first (so
// the sender stops trying even if unsubscribing fails), then the browser's
// subscription.
export async function removePushSubscription(uid) {
  const id = getStoredPushSubscriptionId();
  setStoredPushSubscriptionId(null);
  if (uid && id) await deleteDoc(subscriptionRef(uid, id)).catch(() => {});
  const reg = await registration();
  const subscription = await reg?.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
}

export function subscribeDeviceSent(uid, id, cb) {
  return onSnapshot(
    subscriptionRef(uid, id),
    (snap) => cb(snap.data()?.sent || {}),
    () => cb({}),
  );
}

// Adds shown reminders to this device's `sent` record. A FieldPath per id,
// because reminder ids contain characters a dotted path would split on.
export function recordDeviceSent(uid, id, reminders) {
  if (reminders.length === 0) return Promise.resolve();
  const pairs = reminders.flatMap((r) => [new FieldPath('sent', r.id), r.expiresAt.getTime()]);
  // updateDoc, not a merge: it fails when the document is gone, instead of
  // recreating it as a subscription without an endpoint.
  return updateDoc(subscriptionRef(uid, id), ...pairs);
}
