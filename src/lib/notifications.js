// Browser side of reminders: whether this device can show notifications,
// whether the user switched them on here, which reminders were already sent,
// and the call that actually puts one on screen.
//
// The on/off switch is per device on purpose. What to be reminded of is a
// member's preference and lives on their user document; whether *this* laptop
// or phone should buzz is not.

const DEVICE_KEY = 'familyos:notifications';
const SENT_KEY = 'familyos:remindersSent';
const PUSH_ID_KEY = 'familyos:pushSubscription';
const CHANGE_EVENT = 'familyos:notifications-change';

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

// 'ok', 'needsInstall' (iOS only offers notifications to a Home Screen app)
// or 'unsupported'.
export function notificationSupport() {
  if (typeof window === 'undefined') return 'unsupported';
  if (isIos() && !isStandalone()) return 'needsInstall';
  if (!('Notification' in window)) return 'unsupported';
  return 'ok';
}

export function notificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
  return window.Notification.permission;
}

export function isDeviceEnabled() {
  try {
    return window.localStorage.getItem(DEVICE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function setDeviceEnabled(on) {
  try {
    window.localStorage.setItem(DEVICE_KEY, on ? 'on' : 'off');
  } catch {
    // Private mode: the switch simply does not stick across reloads.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function onNotificationStateChange(cb) {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

// The id of this device's stored push subscription (see
// src/services/pushSubscriptions.js), or null when it has none.
export function getStoredPushSubscriptionId() {
  try {
    return window.localStorage.getItem(PUSH_ID_KEY) || null;
  } catch {
    return null;
  }
}

export function setStoredPushSubscriptionId(id) {
  try {
    if (id) window.localStorage.setItem(PUSH_ID_KEY, id);
    else window.localStorage.removeItem(PUSH_ID_KEY);
  } catch {
    // Without storage the app just re-subscribes on the next start.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'denied';
  const result = await window.Notification.requestPermission();
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return result;
}

// Sent reminders, as { id: expiresAtMs }. Kept in localStorage so every open
// tab shares it and a reload does not send the same reminder again; entries
// are dropped once their reminder has expired, which keeps the list short.
export function loadSentIds(now = Date.now()) {
  let map = {};
  try {
    map = JSON.parse(window.localStorage.getItem(SENT_KEY)) || {};
  } catch {
    map = {};
  }
  const live = Object.fromEntries(Object.entries(map).filter(([, exp]) => exp > now));
  return { ids: new Set(Object.keys(live)), map: live };
}

export function markSent(reminders, now = Date.now()) {
  const { map } = loadSentIds(now);
  for (const r of reminders) map[r.id] = r.expiresAt.getTime();
  try {
    window.localStorage.setItem(SENT_KEY, JSON.stringify(map));
  } catch {
    // Without storage a reminder may repeat after a reload; not worth failing.
  }
}

// Shows one notification. Goes through the service worker when there is one:
// Chrome on Android refuses `new Notification()` outright, and only the
// worker's notificationclick handler can bring the app back to the front.
export async function showNotification({ title, body, tag, url = '/dashboard' }) {
  const options = {
    body,
    tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url },
  };
  const registration = await navigator.serviceWorker?.getRegistration?.();
  if (registration) {
    await registration.showNotification(title, options);
    return;
  }
  const n = new window.Notification(title, options);
  n.onclick = () => {
    window.focus();
    window.location.assign(url);
    n.close();
  };
}
