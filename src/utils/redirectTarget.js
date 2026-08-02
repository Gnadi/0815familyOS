// Where to send someone after they sign in or sign up.
//
// ProtectedRoute has always recorded `state={{ from: location }}` on its
// redirect to /login, but nothing read it back, so every deep link — an invite
// link most of all — dumped the user on /dashboard once they authenticated.
//
// Only same-origin, app-internal paths are honoured: an attacker who can get a
// victim to open /login with crafted router state must not be able to bounce
// them off-site, and returning to /login or /signup would loop.
export function safeRedirect(from, fallback) {
  const path = typeof from === 'string' ? from : from?.pathname;
  if (typeof path !== 'string' || !path) return fallback;
  // "//evil.com" is protocol-relative and would leave the origin.
  if (!path.startsWith('/') || path.startsWith('//')) return fallback;
  if (path.startsWith('/\\')) return fallback;
  if (/^\/(login|signup)(\/|$|\?|#)/.test(path)) return fallback;
  if (typeof from === 'string') return path;
  return `${path}${from?.search || ''}${from?.hash || ''}`;
}
