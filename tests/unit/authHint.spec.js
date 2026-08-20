import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AUTH_HINT_KEY,
  AUTH_HINT_ROUTES,
  clearAuthHint,
  isAuthHintRoute,
  readAuthHint,
  setAuthHint,
} from '../../src/lib/authHint';

// Minimal localStorage stand-in; `throws` simulates the private-browsing modes
// where touching storage raises instead of returning null.
function fakeStorage({ throws = false } = {}) {
  const map = new Map();
  return {
    map,
    getItem: (k) => {
      if (throws) throw new Error('denied');
      return map.has(k) ? map.get(k) : null;
    },
    setItem: (k, v) => {
      if (throws) throw new Error('denied');
      map.set(k, String(v));
    },
    removeItem: (k) => {
      if (throws) throw new Error('denied');
      map.delete(k);
    },
  };
}

const withStorage = (store) => {
  globalThis.window = { localStorage: store };
};

afterEach(() => {
  delete globalThis.window;
});

describe('authHint', () => {
  beforeEach(() => {
    delete globalThis.window;
  });

  it('round-trips both app destinations', () => {
    const store = fakeStorage();
    withStorage(store);
    for (const route of AUTH_HINT_ROUTES) {
      setAuthHint(route);
      expect(readAuthHint()).toBe(route);
    }
  });

  it('clears the hint', () => {
    withStorage(fakeStorage());
    setAuthHint('/dashboard');
    clearAuthHint();
    expect(readAuthHint()).toBeNull();
  });

  it('refuses to store a route the landing redirect does not know', () => {
    const store = fakeStorage();
    withStorage(store);
    setAuthHint('/evil.example.com');
    expect(store.map.has(AUTH_HINT_KEY)).toBe(false);
    expect(readAuthHint()).toBeNull();
  });

  it('reads an unrecognised stored value as no hint', () => {
    const store = fakeStorage();
    store.map.set(AUTH_HINT_KEY, '//evil.example.com');
    withStorage(store);
    expect(readAuthHint()).toBeNull();
  });

  it('is inert without a window (the SSG pre-render)', () => {
    expect(readAuthHint()).toBeNull();
    expect(() => setAuthHint('/dashboard')).not.toThrow();
    expect(() => clearAuthHint()).not.toThrow();
  });

  it('survives storage that throws', () => {
    withStorage(fakeStorage({ throws: true }));
    expect(() => setAuthHint('/dashboard')).not.toThrow();
    expect(readAuthHint()).toBeNull();
    expect(() => clearAuthHint()).not.toThrow();
  });

  it('only accepts the shipped routes', () => {
    expect(isAuthHintRoute('/dashboard')).toBe(true);
    expect(isAuthHintRoute('/')).toBe(false);
    expect(isAuthHintRoute(null)).toBe(false);
  });
});

// The inline reader in index.html has to run before any module loads, so it
// re-implements this module's key and route list by hand. Keep them in sync.
describe('index.html inline redirect', () => {
  const html = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html'),
    'utf8',
  );

  it('reads the same storage key', () => {
    expect(html).toContain(`localStorage.getItem('${AUTH_HINT_KEY}')`);
  });

  it('allows exactly the routes this module can write', () => {
    for (const route of AUTH_HINT_ROUTES) {
      expect(html).toContain(`'${route}'`);
    }
  });

  it('only fires on the landing route', () => {
    expect(html).toContain("location.pathname !== '/'");
  });
});
