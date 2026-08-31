import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildShells } from '../../scripts/emit-app-shell.mjs';

// scripts/emit-app-shell.mjs turns the pre-rendered landing page into the two
// static shells that answer everything the SSG pass skips. The invite shell is
// the only place a messenger crawler can learn what a /join/<token> link is:
// those crawlers never run JS, so nothing <Seo> renders after hydration
// reaches them.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// A stand-in for dist/index.html: the pre-rendered landing page, complete with
// the react-helmet-async tags (data-rh) and the router hydration payload.
const PRERENDERED = [
  '<!DOCTYPE html><html lang="en"><head>',
  '<meta charset="UTF-8">',
  '<link rel="manifest" href="/manifest.webmanifest">',
  '<title data-rh="true">myFAOS — from family chaos to calm</title>',
  '<meta data-rh="true" name="description" content="Landing copy">',
  '<meta data-rh="true" property="og:image" content="https://myfaos.app/og-image.png">',
  '<link data-rh="true" rel="canonical" href="https://myfaos.app/">',
  '<script type="application/ld+json" data-rh="true">{"@type":"WebSite"}</script>',
  '</head><body>',
  '<div id="root" data-server-rendered="true"><main>Landing page markup</main></div>',
  '<script>window.__VITE_REACT_SSG_HASH__="abc"</script>',
  '<script type="module" src="/assets/main.js"></script>',
  '</body></html>',
].join('');

const tag = (html, attr, key) =>
  html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)">`))?.[1] ?? null;

describe('buildShells', () => {
  const shells = buildShells(PRERENDERED);

  it('empties #root and drops the landing page markup from both shells', () => {
    for (const shell of Object.values(shells)) {
      expect(shell).toContain('<div id="root"></div>');
      expect(shell).not.toContain('Landing page markup');
      expect(shell).not.toContain('data-server-rendered');
    }
  });

  it('keeps the entry script and the asset wiring', () => {
    for (const shell of Object.values(shells)) {
      expect(shell).toContain('<script type="module" src="/assets/main.js">');
      expect(shell).toContain('<link rel="manifest" href="/manifest.webmanifest">');
    }
  });

  it('strips the landing route metadata rather than inheriting it', () => {
    for (const shell of Object.values(shells)) {
      expect(shell).not.toContain('from family chaos to calm');
      expect(shell).not.toContain('canonical');
      expect(shell).not.toContain('ld+json');
      expect(shell).not.toContain('og-image.png');
      expect(tag(shell, 'name', 'robots')).toBe('noindex,nofollow');
    }
  });

  it('gives the invite shell a full link preview', () => {
    const join = shells['join.html'];
    expect(join).toContain('<title>Join your family on myFAOS</title>');
    expect(tag(join, 'property', 'og:title')).toBe('Join your family on myFAOS');
    expect(tag(join, 'property', 'og:description')).toMatch(/invited to a family/);
    expect(tag(join, 'name', 'description')).toMatch(/invited to a family/);
    // Absolute URL, correct dimensions: WhatsApp and friends drop the image
    // otherwise and fall back to the bare domain.
    expect(tag(join, 'property', 'og:image')).toBe('https://myfaos.app/og-invite.png');
    expect(tag(join, 'property', 'og:image:secure_url')).toBe(
      'https://myfaos.app/og-invite.png',
    );
    expect(tag(join, 'property', 'og:image:width')).toBe('1200');
    expect(tag(join, 'property', 'og:image:height')).toBe('630');
    expect(tag(join, 'name', 'twitter:card')).toBe('summary_large_image');
  });

  it('ships a German invite shell with its own card', () => {
    const de = shells['join.de.html'];
    expect(de).toContain('<html lang="de"');
    expect(de).toContain('<title>Tritt deiner Familie auf myFAOS bei</title>');
    expect(tag(de, 'property', 'og:description')).toMatch(/eingeladen/);
    expect(tag(de, 'property', 'og:image')).toBe('https://myfaos.app/og-invite-de.png');
    expect(tag(de, 'property', 'og:locale')).toBe('de_DE');
    expect(tag(shells['join.html'], 'property', 'og:locale')).toBe('en_US');
  });

  it('points every invite card at an image that exists', () => {
    for (const name of ['join.html', 'join.de.html']) {
      const src = tag(shells[name], 'property', 'og:image').replace(
        'https://myfaos.app',
        '',
      );
      expect(existsSync(resolve(root, 'public', src.slice(1)))).toBe(true);
    }
  });

  it('honours VITE_SITE_URL for the preview image, without a double slash', () => {
    const join = buildShells(PRERENDERED, { siteUrl: 'https://staging.myfaos.app/' })[
      'join.html'
    ];
    expect(tag(join, 'property', 'og:image')).toBe(
      'https://staging.myfaos.app/og-invite.png',
    );
  });

  it('never names the family in an invite card', () => {
    // The card is rendered by every chat the link is forwarded into, long
    // before anyone signs in. It must stay as anonymous as the token itself.
    for (const name of ['join.html', 'join.de.html']) {
      expect(shells[name]).not.toMatch(/familyName|\{family\}/);
    }
  });

  it('leaves the private app shell without a social card', () => {
    const app = shells['app.html'];
    expect(app).toContain('<title>myFAOS</title>');
    expect(app).not.toContain('og:image');
    expect(app).not.toContain('twitter:card');
  });
});

describe('routing wiring', () => {
  const { rewrites } = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));
  const indexOf = (destination) => rewrites.findIndex((r) => r.destination === destination);

  it('serves /join/<token> from the invite shells, ahead of the app catch-all', () => {
    const de = indexOf('/join.de.html');
    const en = indexOf('/join.html');
    const app = indexOf('/app.html');
    expect(de).toBeGreaterThanOrEqual(0);
    expect(en).toBeGreaterThanOrEqual(0);
    // Vercel takes the first match: the language-specific rule has to be
    // tried before the plain one, and the app catch-all must come last.
    expect(de).toBeLessThan(en);
    expect(en).toBeLessThan(app);
    expect(rewrites[en].source).toBe('/join/:token');
    expect(rewrites[de].source).toBe('/join/:token');
  });

  it('matches the German shell on a German Accept-Language only', () => {
    const { value } = rewrites[indexOf('/join.de.html')].has[0];
    const matches = (header) => new RegExp(value).test(header);
    expect(matches('de')).toBe(true);
    expect(matches('de-DE')).toBe(true);
    expect(matches('de-AT,de;q=0.9,en;q=0.8')).toBe(true);
    expect(matches('de;q=0.9')).toBe(true);
    expect(matches('en-US,en;q=0.9')).toBe(false);
    // German further down someone else's list is not a German client.
    expect(matches('en-US,en;q=0.9,de;q=0.8')).toBe(false);
  });
});
