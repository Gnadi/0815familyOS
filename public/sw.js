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
