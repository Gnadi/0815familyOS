// A member's display name is stored in two places (the Firebase Auth profile
// and the user document) and is rendered in tight spots all over the app —
// avatar initials, assignment chips, calendar filter rows — so every write
// goes through the same normalization: collapse runs of whitespace, trim, and
// cap the length so a pasted paragraph cannot blow up the layout.
export const DISPLAY_NAME_MAX = 40;

export function normalizeDisplayName(value) {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, DISPLAY_NAME_MAX);
}
