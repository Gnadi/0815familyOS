import { resolveQuickAccess, sanitizeQuickAccess } from './quickAccess';

// The family-wide navigation layout lives on the family document as
//
//   navLayout: { bottomNav: [...ids], quickAccess: [...ids], quickAccessSeen: [...ids] }
//
// Every field is optional. A missing field means "nobody in this family has
// customised it yet", and the caller's fallback applies — for Quick Access
// that is the device-local preference the app used before the layout became a
// family setting, so nobody's existing shortcuts change under them.

// Drops unknown ids and duplicates, then enforces the size limits. Returns
// null for anything unusable so the caller falls back to the default.
export function sanitizeBottomNav(list, { allIds, min, max }) {
  const clean = sanitizeQuickAccess(list, allIds);
  if (!clean || clean.length < min) return null;
  return clean.slice(0, max);
}

export function resolveNavLayout({ stored, fallbackQuickAccess, quickAccess, bottomNav }) {
  const layout = stored && typeof stored === 'object' ? stored : {};

  const resolvedBottomNav =
    sanitizeBottomNav(layout.bottomNav, bottomNav) ?? [...bottomNav.defaults];

  // Same "offer new shortcuts once" migration as the local preference, with
  // the seen-list stored next to the family's list.
  const resolvedQuickAccess = Array.isArray(layout.quickAccess)
    ? resolveQuickAccess({
        stored: layout.quickAccess,
        seen: layout.quickAccessSeen,
        allIds: quickAccess.allIds,
        defaults: quickAccess.defaults,
        legacyIds: quickAccess.allIds,
      })
    : [...fallbackQuickAccess];

  return {
    bottomNav: resolvedBottomNav,
    quickAccess: resolvedQuickAccess,
    customised: Array.isArray(layout.bottomNav) || Array.isArray(layout.quickAccess),
  };
}

// Toggling and reordering, shared by both lists in Settings.
export function toggleId(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function moveId(list, id, delta) {
  const idx = list.indexOf(id);
  const next = idx + delta;
  if (idx < 0 || next < 0 || next >= list.length) return list;
  const reordered = [...list];
  [reordered[idx], reordered[next]] = [reordered[next], reordered[idx]];
  return reordered;
}
