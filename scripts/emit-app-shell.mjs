// Post-build step: emit dist/app.html, the shell served for the private app
// routes (/dashboard, /calendar, …).
//
// Only the public pages are pre-rendered (see ssgOptions.includedRoutes in
// vite.config.js), so without this every app route fell back to dist/index.html
// — which *is* the pre-rendered landing page. Deep-linking or refreshing on
// /dashboard therefore painted the full marketing page first, shipped ~40 KB of
// markup the app immediately threw away, and left the document advertising the
// landing page's <title> and an index,follow robots tag on a private screen.
//
// app.html keeps the same <head> asset/preload wiring and the same entry
// script, but with an empty #root, no pre-rendered markup, no router hydration
// payload, and noindex metadata.
//
// Caveat: vite-react-ssg always calls hydrateRoot() in a production build, so
// React still logs one recoverable hydration warning against the empty root
// before it client-renders. Removing that needs a change in the library, not
// here; everything the shell can fix (the flash of the marketing page, the
// wasted bytes, the wrong metadata) it does fix.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const source = resolve(distDir, 'index.html');
const target = resolve(distDir, 'app.html');

const HASH_SCRIPT = '<script>window.__VITE_REACT_SSG_HASH__';
const ROOT_OPEN = '<div id="root"';

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

// Drop the tags react-helmet-async injected for the landing route (it marks
// every one of them with data-rh) plus its JSON-LD block, then state plainly
// that this shell is not for indexing.
function neutralHead(html) {
  const stripped = html
    .replace(/<title data-rh="true">[\s\S]*?<\/title>/g, '')
    .replace(/<script type="application\/ld\+json" data-rh="true">[\s\S]*?<\/script>/g, '')
    .replace(/<(meta|link) data-rh="true"[^>]*>/g, '');
  return stripped.replace(
    '</head>',
    '<meta charset="utf-8"><title>myFAOS</title>' +
      '<meta name="robots" content="noindex,nofollow"></head>',
  );
}

const html = readFileSync(source, 'utf8');
const shell = neutralHead(emptyRoot(html));

if (shell.includes('data-server-rendered')) {
  throw new Error('emit-app-shell: pre-rendered markup survived into the shell');
}

writeFileSync(target, shell);
console.log(
  `[emit-app-shell] dist/app.html  ${(shell.length / 1024).toFixed(2)} KiB ` +
    `(from ${(html.length / 1024).toFixed(2)} KiB index.html)`,
);
