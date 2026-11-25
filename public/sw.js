/* myFAOS service worker.
 *
 * Goals: make the app installable, start fast on a home-screen launch and stay
 * usable offline -- without ever getting in the way of Firebase/Firestore
 * realtime traffic.
 *
 * Strategy:
 *   - Navigations -> network-first with a ~3 s timeout, then the cached copy.
 *     Every private app route is served by the same /app.html shell (see
 *     vercel.json), so they share one cache entry and work offline even when
 *     that exact URL was never visited. Public pages (/, /privacy, /terms) are
 *     cached per URL.
 *   - /assets/* (content-hashed by Vite, never change) -> cache-first. No
 *     revalidation request on every start; old hashes are trimmed.
 *   - Other same-origin static files (icons, fonts, manifest) -> stale-while-
 *     revalidate, since their URLs are not hashed.
 *   - Everything cross-origin (Firebase, Google APIs) -> passthrough.
 *
 * The build (scripts/emit-app-shell.mjs) replaces the PRECACHE_ASSETS
 * placeholder with the hashed entry/startup chunks, so the first launch after
 * install does not need the network for JS. In dev it stays an empty list.
 *
 * Bump CACHE_VERSION to invalidate the shell/static caches on activation.
 */
const CACHE_VERSION = 'v2';
const SHELL_CACHE = `faos-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `faos-static-${CACHE_VERSION}`;
// Hashed assets are immutable, so this cache survives version bumps; it is
// trimmed to the newest entries instead.
const ASSET_CACHE = 'faos-assets';
const ASSET_CACHE_MAX_ENTRIES = 120;
const KEEP = new Set([SHELL_CACHE, STATIC_CACHE, ASSET_CACHE]);

const NAV_TIMEOUT_MS = 3000;
const APP_SHELL = '/app.html';
const PUBLIC_PAGES = new Set(['/', '/privacy', '/privacy/', '/terms', '/terms/']);

// Minimal shell precached on install so a cold offline load still renders.
const PRECACHE_URLS = ['/', APP_SHELL, '/manifest.webmanifest', '/favicon.svg'];
const PRECACHE_ASSETS = /*__PRECACHE_ASSETS__*/ [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      // Best-effort per URL: one missing file must not abort the install.
      await Promise.all(PRECACHE_URLS.map((u) => shell.add(u).catch(() => {})));
      const assets = await caches.open(ASSET_CACHE);
      await Promise.all(
        PRECACHE_ASSETS.map(async (u) => {
          if (await assets.match(u)) return;
          await assets.add(u).catch(() => {});
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trimAssets() {
  const cache = await caches.open(ASSET_CACHE);
  const keys = await cache.keys();
  // Cache keys come back in insertion order: drop the oldest.
  const excess = keys.length - ASSET_CACHE_MAX_ENTRIES;
  for (let i = 0; i < excess; i += 1) await cache.delete(keys[i]);
}

function isStaticAsset(url) {
  return /\.(?:js|css|png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf|json|webmanifest)$/.test(
    url.pathname,
  );
}

function cacheable(response) {
  return response && response.ok && response.type === 'basic';
}

// Resolves with the network response, or with the cached one if the network
// is slower than NAV_TIMEOUT_MS (or fails). Without a cached copy it keeps
// waiting for the network -- a slow page beats an error page.
function networkFirstNavigation(event, cacheKey) {
  const { request } = event;
  // Started synchronously so the worker is kept alive (waitUntil) until the
  // fresh copy is stored, even when the cached copy already answered.
  const network = fetch(request).then(async (response) => {
    if (cacheable(response)) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(cacheKey, response.clone());
    }
    return response;
  });
  event.waitUntil(network.catch(() => {}));

  return (async () => {
    const cached = await caches.match(cacheKey, { cacheName: SHELL_CACHE });
    if (!cached) {
      try {
        return await network;
      } catch {
        return (await caches.match(APP_SHELL, { cacheName: SHELL_CACHE })) || Response.error();
      }
    }
    const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NAV_TIMEOUT_MS));
    try {
      return await Promise.race([network, timeout]);
    } catch {
      return cached;
    }
  })();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle our own origin. Firebase, Firestore, Google APIs etc. must
  // reach the network untouched (and must never be cached).
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    // Invite links are personalised per token and per language; leave them to
    // the network (they need it to read the invite anyway).
    if (url.pathname.startsWith('/join/')) return;
    const key = PUBLIC_PAGES.has(url.pathname) ? url.pathname : APP_SHELL;
    event.respondWith(networkFirstNavigation(event, key));
    return;
  }

  // Hashed build output: cache-first, never revalidated.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (cacheable(response)) {
          // Not awaited: the page should not wait on the cache write.
          cache.put(request, response.clone()).then(trimAssets).catch(() => {});
        }
        return response;
      }),
    );
    return;
  }

  // Unhashed static files: stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((response) => {
              if (cacheable(response)) cache.put(request, response.clone());
              return response;
            })
            .catch(() => cached);
          return cached || network;
        }),
      ),
    );
  }
});
