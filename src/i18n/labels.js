// Resolve a display label for objects that may carry an i18n `labelKey`
// (built-in categories, statuses, priorities, meal slots…) while leaving
// user-created entries — which only have a free-text `label` — untranslated.
//   tLabel(t, { labelKey: 'cat.health', label: 'Health' }) → translated
//   tLabel(t, { label: 'Soccer club' })                    → 'Soccer club'
export function tLabel(t, obj) {
  if (!obj) return '';
  return obj.labelKey ? t(obj.labelKey) : obj.label || '';
}
