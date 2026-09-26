/* myFAOS service worker.
 *
 * Goals: make the app installable and resilient offline without ever getting in
 * the way of Firebase/Firestore realtime traffic.
 *
 * Strategy:
 *   - Navigations  -> network-first, fall back to the cached shell when offline.
 *   - Static assets (same-origin JS/CSS/img/font) -> stale-while-revalidate.
 *   - Everything cross-origin (Firebase, Google APIs, fonts CDN) -> passthrough.
 *
 * Bump CACHE_VERSION to invalidate old caches on the next activation.
 */
const CACHE_VERSION = 'v1';
const CACHE_NAME = `faos-${CACHE_VERSION}`;

// Minimal shell precached on install so a cold offline load still renders.
const PRECACHE_URLS = ['/', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return /\.(?:js|css|png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf|json|webmanifest)$/.test(
    url.pathname,
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle our own origin. Firebase, Firestore, Google Fonts, etc. must
  // reach the network untouched (and must never be cached).
  if (url.origin !== self.location.origin) return;

  // App navigations: network-first with a cached-shell fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/'))),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((response) => {
              if (response && response.status === 200) cache.put(request, response.clone());
              return response;
            })
            .catch(() => cached);
          return cached || network;
        }),
      ),
    );
  }
});

// Reminders pushed while the app is closed (functions/sendReminders.js). The
// payload is the finished notification: { title, body, tag, url }. Every push
// must show something -- browsers revoke the subscription of a worker that
// receives pushes silently -- hence the fallback title.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'myFAOS', {
      body: payload.body || '',
      tag: payload.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url || '/dashboard' },
    }),
  );
});

// Reminder notifications (see src/lib/notifications.js) carry the page they are
// about in `data.url`. A tap brings an open myFAOS window to the front and
// takes it there, or opens a new one when none is running.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/dashboard', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        return open.focus().then((w) => {
          const client = w || open;
          return client.navigate ? client.navigate(target) : client;
        });
      }
      return self.clients.openWindow(target);
    }),
  );
});
