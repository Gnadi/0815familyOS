// Post-build step: emit the static shells that back every route the SSG pass
// does not pre-render.
//
//   dist/app.html      the private app routes (/dashboard, /calendar, …)
//   dist/join.html     invite links (/join/<token>)
//   dist/join.de.html  the same, for German-speaking clients
//
// Only the public pages are pre-rendered (see ssgOptions.includedRoutes in
// vite.config.js), so without this every app route fell back to dist/index.html
// — which *is* the pre-rendered landing page. Deep-linking or refreshing on
// /dashboard therefore painted the full marketing page first, shipped ~40 KB of
// markup the app immediately threw away, and left the document advertising the
// landing page's <title> and an index,follow robots tag on a private screen.
//
// Every shell keeps the same <head> asset/preload wiring and the same entry
// script as index.html, but with an empty #root, no pre-rendered markup, no
// router hydration payload, and noindex metadata. They differ only in the
// metadata a link crawler reads:
//
//   app.html   just a title. These URLs are private; nobody should be
//              generating a rich preview of someone's dashboard.
//   join.*     a full Open Graph / Twitter card. An invite link is *made* to be
//              forwarded through WhatsApp, Signal, iMessage or a group chat,
//              and those crawlers never run JS — whatever <Seo> would render
//              after hydration is invisible to them. Without these tags the
//              messenger falls back to the bare domain and the invitation looks
//              like a stray link. There is one shell per UI language because a
//              static card cannot localize itself after the fact; vercel.json
//              picks between them on Accept-Language. The family name is
//              deliberately absent: the card is public to every chat the link
//              passes through, and reading an invite requires an authenticated
//              caller anyway.
//
// Caveat: vite-react-ssg always calls hydrateRoot() in a production build, so
// React still logs one recoverable hydration warning against the empty root
// before it client-renders. Removing that needs a change in the library, not
// here; everything the shells can fix (the flash of the marketing page, the
// wasted bytes, the wrong metadata) they do fix.

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

// Mirrors src/config/site.js — absolute URLs are mandatory in OG tags.
const DEFAULT_SITE_URL = 'https://myfaos.app';

const HASH_SCRIPT = '<script>window.__VITE_REACT_SSG_HASH__';
const ROOT_OPEN = '<div id="root"';

// Copy for the invite cards. The images are built by
// scripts/generate_invite_og_image.py; keep the two in sync.
const INVITE_PREVIEWS = {
  'join.html': {
    lang: 'en',
    locale: 'en_US',
    title: 'Join your family on myFAOS',
    description:
      'You have been invited to a family on myFAOS — one shared space for the calendar, tasks, meals, shopping list and documents. Free and open source.',
    image: '/og-invite.png',
    imageAlt: 'myFAOS invitation: three family members and one open seat.',
  },
  'join.de.html': {
    lang: 'de',
    locale: 'de_DE',
    title: 'Tritt deiner Familie auf myFAOS bei',
    description:
      'Du wurdest zu einer Familie auf myFAOS eingeladen — ein gemeinsamer Ort für Kalender, Aufgaben, Essensplan, Einkaufsliste und Dokumente. Kostenlos und Open Source.',
    image: '/og-invite-de.png',
    imageAlt: 'myFAOS-Einladung: drei Familienmitglieder und ein freier Platz.',
  },
};

function emptyRoot(html) {
  const start = html.indexOf(ROOT_OPEN);
  if (start === -1) throw new Error('emit-app-shell: #root container not found');
  // The pre-rendered tree and the router hydration payload both live inside
  // #root, so the span ends at the last </div> before the SSG hash script.
  const after = html.indexOf(HASH_SCRIPT, start);
  const searchEnd = after === -1 ? html.length : after;
  const end = html.lastIndexOf('</div>', searchEnd);
  if (end === -1 || end < start) throw new Error('emit-app-shell: #root end not found');
  return html.slice(0, start) + '<div id="root"></div>' + html.slice(end + '</div>'.length);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const meta = (attr, key, content) => `<meta ${attr}="${key}" content="${esc(content)}">`;

// The Open Graph / Twitter block for an invite shell. og:url is intentionally
// omitted: one static file answers every /join/<token> URL, so any value here
// would be wrong for all but one of them — crawlers fall back to the URL they
// fetched, which is the correct one.
function socialTags({ title, description, image, imageAlt, locale }) {
  const alternate = locale === 'de_DE' ? 'en_US' : 'de_DE';
  return [
    meta('name', 'description', description),
    meta('property', 'og:site_name', 'myFAOS'),
    meta('property', 'og:type', 'website'),
    meta('property', 'og:title', title),
    meta('property', 'og:description', description),
    meta('property', 'og:image', image),
    // WhatsApp reads og:image:secure_url first; without it some clients skip
    // the image entirely.
    meta('property', 'og:image:secure_url', image),
    meta('property', 'og:image:type', 'image/png'),
    meta('property', 'og:image:width', '1200'),
    meta('property', 'og:image:height', '630'),
    meta('property', 'og:image:alt', imageAlt),
    meta('property', 'og:locale', locale),
    meta('property', 'og:locale:alternate', alternate),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', title),
    meta('name', 'twitter:description', description),
    meta('name', 'twitter:image', image),
    meta('name', 'twitter:image:alt', imageAlt),
  ].join('');
}

// Drop the tags react-helmet-async injected for the landing route (it marks
// every one of them with data-rh) plus its JSON-LD block, then state plainly
// that this shell is not for indexing. Invite links carry a secret token in the
// path and app routes are private, so neither belongs in a search index —
// messenger crawlers build their preview from the Open Graph tags regardless.
function neutralHead(html, { title, lang = 'en', social = '', extraHead = '' }) {
  const stripped = html
    .replace(/<title data-rh="true">[\s\S]*?<\/title>/g, '')
    .replace(/<script type="application\/ld\+json" data-rh="true">[\s\S]*?<\/script>/g, '')
    .replace(/<(meta|link) data-rh="true"[^>]*>/g, '')
    // The landing hero screenshot is the landing page's LCP image. In a shell
    // it would only compete with the JS the app actually needs.
    .replace(/<link rel="preload" as="image" href="\/screenshots\/[^"]*"[^>]*>/g, '')
    .replace(/<html lang="[^"]*"/, `<html lang="${lang}"`);
  return stripped.replace(
    '</head>',
    `<meta charset="utf-8"><title>${esc(title)}</title>` +
      '<meta name="robots" content="noindex,nofollow">' +
      social +
      extraHead +
      '</head>',
  );
}

// Origins every signed-in start talks to (Auth token refresh, Firestore). A
// preconnect saves the DNS + TLS round trips while the JS is still loading.
export const APP_PRECONNECT = [
  'https://firestore.googleapis.com',
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com',
];

// Chunks a signed-in start needs right after the entry: the Firebase SDK and
// the user/family services (requested by AuthProvider), the protected layout
// and the default landing route. Without hints the browser only discovers them
// one dynamic import at a time -- entry, then auth, then the layout, then the
// page -- each a full round trip.
const PRELOAD_ROOTS = [
  { name: 'firebaseApp' },
  { name: 'firebase' },
  { name: 'users' },
  { name: 'families' },
  { src: 'src/routes/ProtectedAppLayout.jsx' },
  { src: 'src/pages/DashboardPage.jsx' },
];

// Resolve PRELOAD_ROOTS against a Vite manifest into the JS files to preload
// (with their static imports), excluding what the entry already loads. Also
// returns the entry's own files, which the service worker precaches together
// with the preloads. Pure: tests feed it a hand-written manifest.
export function startupChunks(manifest) {
  const entries = Object.entries(manifest || {});
  const entry = entries.find(([, v]) => v.isEntry);
  if (!entry) return { preload: [], precache: [] };

  const closure = (keys) => {
    const seen = new Set();
    const walk = (key) => {
      if (seen.has(key) || !manifest[key]) return;
      seen.add(key);
      for (const imp of manifest[key].imports || []) walk(imp);
    };
    keys.forEach(walk);
    return seen;
  };

  const entryKeys = closure([entry[0]]);
  const rootKeys = PRELOAD_ROOTS.flatMap(({ name, src }) =>
    entries
      .filter(([k, v]) => (src ? k === src : v.name === name && !v.isEntry))
      .map(([k]) => k),
  );
  const preloadKeys = [...closure(rootKeys)].filter((k) => !entryKeys.has(k));

  const fileOf = (k) => `/${manifest[k].file}`;
  const preload = preloadKeys.map(fileOf);
  const entryFiles = [...entryKeys].map(fileOf);
  const css = [...entryKeys, ...preloadKeys].flatMap((k) => (manifest[k].css || []).map((c) => `/${c}`));
  return { preload, precache: [...new Set([...entryFiles, ...preload, ...css])] };
}

function appHead(preload) {
  return (
    APP_PRECONNECT.map((o) => `<link rel="preconnect" href="${o}" crossorigin>`).join('') +
    preload.map((f) => `<link rel="modulepreload" crossorigin href="${esc(f)}">`).join('')
  );
}

// Exported (and pure) so tests/unit/appShell.spec.js can assert the metadata
// without running a full production build.
export function buildShells(html, { siteUrl = DEFAULT_SITE_URL, preload = [] } = {}) {
  const site = siteUrl.replace(/\/$/, '');
  const bare = emptyRoot(html);

  const shells = {
    'app.html': neutralHead(bare, { title: 'myFAOS', extraHead: appHead(preload) }),
  };
  for (const [name, preview] of Object.entries(INVITE_PREVIEWS)) {
    shells[name] = neutralHead(bare, {
      title: preview.title,
      lang: preview.lang,
      social: socialTags({ ...preview, image: `${site}${preview.image}` }),
    });
  }

  for (const [name, shell] of Object.entries(shells)) {
    if (shell.includes('data-server-rendered')) {
      throw new Error(`emit-app-shell: pre-rendered markup survived into ${name}`);
    }
  }
  return shells;
}

function readManifest(distDir) {
  const path = resolve(distDir, '.vite', 'manifest.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

// Fill the service worker's precache list with this build's hashed startup
// chunks. Fails soft: without a manifest the worker keeps an empty list.
function injectPrecache(distDir, files) {
  const swPath = resolve(distDir, 'sw.js');
  if (!existsSync(swPath)) return;
  const sw = readFileSync(swPath, 'utf8');
  const marker = '/*__PRECACHE_ASSETS__*/ []';
  if (!sw.includes(marker)) return;
  writeFileSync(swPath, sw.replace(marker, JSON.stringify(files)));
  console.log(`[emit-app-shell] dist/sw.js  precaching ${files.length} startup assets`);
}

function main() {
  const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  const html = readFileSync(resolve(distDir, 'index.html'), 'utf8');
  const manifest = readManifest(distDir);
  const { preload, precache } = startupChunks(manifest);
  if (!manifest) console.warn('[emit-app-shell] no Vite manifest; app.html gets no modulepreload hints');
  const shells = buildShells(html, {
    siteUrl: process.env.VITE_SITE_URL || DEFAULT_SITE_URL,
    preload,
  });
  injectPrecache(distDir, precache);

  for (const [name, shell] of Object.entries(shells)) {
    writeFileSync(resolve(distDir, name), shell);
    console.log(
      `[emit-app-shell] dist/${name}  ${(shell.length / 1024).toFixed(2)} KiB ` +
        `(from ${(html.length / 1024).toFixed(2)} KiB index.html)`,
    );
  }

  // The manifests are build metadata only (read above); nothing at runtime
  // uses them, so keep them out of the public deploy.
  rmSync(resolve(distDir, '.vite'), { recursive: true, force: true });
}

// Only when run as a script (`node scripts/emit-app-shell.mjs`), not on import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
