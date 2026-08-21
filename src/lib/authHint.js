// "Is this visitor signed in?" hint, written to localStorage.
//
// Why it exists: `/` is the pre-rendered marketing page, and Firebase Auth can
// only tell us who the visitor is *asynchronously* (its session lives in
// IndexedDB, and the SDK itself is code-split out of the initial chunk). A
// signed-in user therefore used to see the full landing page for a second
// before the post-hydration redirect in LandingPage kicked in.
//
// The hint is a synchronously readable breadcrumb of the last resolved auth
// state, so the tiny inline script in index.html can bounce a returning user
// straight to their app route before the landing markup ever paints.
//
// It is a *hint*, never an authority: it holds no token and grants no access.
// A stale one (session expired, signed out in another browser) simply sends the
// visitor to a protected route, where ProtectedRoute redirects them to /login
// and AuthProvider clears the hint. Demo sessions never write it.
//
// IMPORTANT: the inline reader in index.html duplicates KEY and ROUTES by hand
// (it must run before any module loads). tests/unit/authHint.spec.js asserts
// the two stay in sync — update both together.

export const AUTH_HINT_KEY = 'faos:signed-in';

// The two destinations the landing page redirects an authenticated visitor to.
export const AUTH_HINT_ROUTES = ['/dashboard', '/family-setup'];

export function isAuthHintRoute(value) {
  return AUTH_HINT_ROUTES.includes(value);
}

function storage() {
  // Absent during the Node pre-render; throws in some private-browsing modes.
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

// Returns the stored route, or null when there is no usable hint. Anything
// unrecognised (hand-edited storage, a route we no longer ship) reads as null.
export function readAuthHint() {
  try {
    const value = storage()?.getItem(AUTH_HINT_KEY);
    return isAuthHintRoute(value) ? value : null;
  } catch {
    return null;
  }
}

export function setAuthHint(route) {
  if (!isAuthHintRoute(route)) return;
  try {
    storage()?.setItem(AUTH_HINT_KEY, route);
  } catch {
    /* storage unavailable — the app just falls back to the slower redirect */
  }
}

export function clearAuthHint() {
  try {
    storage()?.removeItem(AUTH_HINT_KEY);
  } catch {
    /* nothing to clean up */
  }
}
