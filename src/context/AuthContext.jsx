import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isDemoMode } from '../lib/demoMode';
import { clearAuthHint, readAuthHint, setAuthHint } from '../lib/authHint';

// Pre-rendered marketing/legal pages. A visitor here without an auth hint is
// almost certainly signed out, so Firebase is started at idle time instead of
// competing with the page itself.
const PUBLIC_PATHS = new Set(['/', '/privacy', '/privacy/', '/terms', '/terms/']);
const IDLE_START_TIMEOUT_MS = 4000;

function scheduleIdle(fn) {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(fn, { timeout: IDLE_START_TIMEOUT_MS });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 1500);
  return () => window.clearTimeout(id);
}

export const AuthContext = createContext({
  user: null,
  userDoc: null,
  family: null,
  encryptionKey: null,
  loading: true,
  isDemo: false,
  signOut: () => {},
});

// Startup: on app routes (or with an auth hint) Firebase Auth and the
// user/family services are imported in one parallel batch, so Firestore is
// already loading while Auth restores the session. On the public pages without
// a hint only Auth (lib/firebaseApp, no Firestore) is started, at idle time.
//
// Firebase (auth + firestore) is imported lazily inside effects/handlers rather
// than at module scope. This keeps the ~200 KB Firebase SDK out of the initial
// JS chunk that loads on the pre-rendered marketing landing page — it is
// fetched right after hydration instead. Logged-out visitors (the common case
// for the landing page) never block on it, which meaningfully improves LCP/FCP.
// Behaviour is otherwise identical to a static import; ES modules are
// singletons, so lib/firebase initializes exactly once no matter how many
// effects import it.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [family, setFamily] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [loading, setLoading] = useState(true);
  // Stable for the lifetime of the page: entering/leaving the demo is always
  // a hard navigation (see lib/demoMode.js), so the provider initializes down
  // exactly one path per load and never has to tear listeners across modes.
  const demo = isDemoMode();

  const { pathname } = useLocation();
  const onPublicPage = PUBLIC_PATHS.has(pathname);
  // Decided once: does this page load look like a signed-in visit?
  const [expectSignedIn] = useState(() => !onPublicPage || Boolean(readAuthHint()));
  const [armed, setArmed] = useState(expectSignedIn);
  // The user doc is created by the sign-up/sign-in flows (services/auth.js).
  // This is only the safety net for accounts without one; it runs when the
  // live snapshot reports the doc missing, not as an extra read on every load.
  const ensuredFor = useRef(null);

  // Arm immediately when navigating off the public pages (e.g. to /login);
  // otherwise once the browser is idle, so a signed-in visitor without a hint
  // is still redirected from the landing page.
  useEffect(() => {
    if (armed || demo) return undefined;
    if (!onPublicPage) {
      setArmed(true);
      return undefined;
    }
    return scheduleIdle(() => setArmed(true));
  }, [armed, demo, onPublicPage]);

  useEffect(() => {
    // Demo: fabricate the signed-in user from the demo store and never touch
    // Firebase Auth — no listener attached, no network. Everything downstream
    // (userDoc, family, data hooks) routes through the demo-aware services.
    if (demo) {
      let cancelled = false;
      (async () => {
        const { demoUser } = await import('../services/demoStore');
        if (!cancelled) setUser(demoUser());
      })();
      return () => {
        cancelled = true;
      };
    }
    if (!armed) return undefined;
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      const [{ onAuthStateChanged }, { auth }] = await Promise.all([
        import('firebase/auth'),
        import('../lib/firebaseApp'),
        // Warm the Firestore-backed services in the same round trip when a
        // signed-in start is likely; the effects below import them again
        // (instantly, from the module cache).
        ...(expectSignedIn
          ? [import('../services/users'), import('../services/families')]
          : []),
      ]);
      if (cancelled) return;
      // No usable Firebase config: stay signed-out rather than crashing. The
      // landing/legal pages and the offline demo remain fully usable.
      if (!auth) {
        setUser(null);
        setLoading(false);
        return;
      }
      unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        if (!u) {
          // Signed out (or the persisted session expired): drop the breadcrumb
          // so the next visit to "/" shows the landing page again instead of
          // bouncing through a protected route.
          clearAuthHint();
          setUserDoc(null);
          setFamily(null);
          setEncryptionKey(null);
          setLoading(false);
        }
      });
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [demo, armed, expectSignedIn]);

  useEffect(() => {
    if (!user) return undefined;
    setLoading(true);
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      if (demo) {
        const { demoSubscribeUserDoc } = await import('../services/demoStore');
        if (cancelled) return;
        unsub = demoSubscribeUserDoc((d) => {
          setUserDoc(d);
          setLoading(false);
        });
        return;
      }
      const { subscribeUserDoc, ensureUserDoc } = await import('../services/users');
      if (cancelled) return;
      unsub = subscribeUserDoc(user.uid, (d) => {
        if (!d && ensuredFor.current !== user.uid) {
          ensuredFor.current = user.uid;
          // ensureUserDoc re-checks before writing, so a cache-only "missing"
          // snapshot on a fresh device never overwrites the real document.
          ensureUserDoc(user).catch(console.error);
        }
        setUserDoc(d);
        // Remember where this browser belongs, so index.html can skip the
        // landing page on the next visit. Written here (not on sign-in) so it
        // also tracks a user who leaves /family-setup by joining a family.
        // Demo sessions deliberately never write it.
        if (d) setAuthHint(d.familyId ? '/dashboard' : '/family-setup');
        setLoading(false);
      });
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [user, demo]);

  useEffect(() => {
    if (!userDoc?.familyId) {
      setFamily(null);
      return undefined;
    }
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      const { subscribeFamily } = await import('../services/families');
      if (cancelled) return;
      unsub = subscribeFamily(userDoc.familyId, setFamily);
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [userDoc?.familyId]);

  useEffect(() => {
    if (!family) {
      setEncryptionKey(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const { importEncryptionKey } = await import('../utils/encryption');
      if (cancelled) return;
      // Older families predate the vault and have no key yet. Backfilling is a
      // transaction in the service layer so concurrent members converge on one
      // key instead of overwriting each other's (see ensureFamilyEncryptionKey).
      let jwk = family.encryptionKeyJwk;
      if (!jwk) {
        const { ensureFamilyEncryptionKey } = await import('../services/families');
        if (cancelled) return;
        jwk = await ensureFamilyEncryptionKey(family.id);
      }
      if (cancelled || !jwk) return;
      const key = await importEncryptionKey(jwk);
      if (!cancelled) setEncryptionKey(key);
    })();
    return () => {
      cancelled = true;
    };
  }, [family?.id, family?.encryptionKeyJwk]);

  const signOut = useCallback(async () => {
    const { signOut: fbSignOut } = await import('../services/auth');
    return fbSignOut();
  }, []);

  const value = useMemo(
    () => ({ user, userDoc, family, encryptionKey, loading, isDemo: demo, signOut }),
    [user, userDoc, family, encryptionKey, loading, demo, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
