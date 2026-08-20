// Quick Access is a stored user preference, which means a shortcut shipped
// after a user last touched that list would never appear for them: the stored
// array simply doesn't mention it, and sanitizing only ever drops unknown ids.
// That is how the Tracker shortcut stayed invisible on existing installs.
//
// The fix is a second stored list of the ids the user has already been
// *offered*. Anything in the catalogue missing from that list is new since
// their last visit and gets appended once. A shortcut they deliberately
// removed stays removed, because it is still in the "offered" list.

// Drops unknown ids and duplicates while preserving the stored order, so stale
// localStorage entries can't render broken shortcuts.
export function sanitizeQuickAccess(list, allIds) {
  if (!Array.isArray(list)) return null;
  return [...new Set(list)].filter((id) => allIds.includes(id));
}

// Resolves the shortcuts to show, migrating in anything shipped since the user
// last edited their list.
//
//   - No stored list at all -> a fresh install, which gets the defaults and
//     nothing else. (Appending the rest of the catalogue here would hand every
//     new user every shortcut.)
//   - Stored list but no `seen` record -> an install from before this
//     migration existed. `legacyIds` is what the catalogue held back then, so
//     anything added since is genuinely new to them. Passing today's defaults
//     instead would silently count new shortcuts as already-offered.
//   - Both present -> the normal path.
export function resolveQuickAccess({ stored, seen, allIds, defaults, legacyIds }) {
  const current = sanitizeQuickAccess(stored, allIds);
  if (!current) return [...defaults];

  const offered = sanitizeQuickAccess(seen, allIds) ?? legacyIds;
  const additions = allIds.filter((id) => !offered.includes(id) && !current.includes(id));
  return additions.length ? [...current, ...additions] : current;
}
