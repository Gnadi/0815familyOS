// Hardcoded Tailwind class names (no string interpolation) so Tailwind's
// content scan keeps them in the production build.

// Fixed palette users can choose from when creating a custom category.
export const COLOR_PALETTE = {
  slate: {
    bar: 'bg-slate-400',
    dot: 'bg-slate-400',
    chipBg: 'bg-slate-100 dark:bg-slate-700',
    chipText: 'text-slate-700 dark:text-slate-300',
    iconBg: 'bg-slate-100 dark:bg-slate-700',
    iconColor: 'text-slate-600 dark:text-slate-300',
    swatch: 'bg-slate-400',
  },
  blue: {
    bar: 'bg-brand-500',
    dot: 'bg-brand-500',
    chipBg: 'bg-brand-50 dark:bg-brand-950/40',
    chipText: 'text-brand-700 dark:text-brand-400',
    iconBg: 'bg-brand-50 dark:bg-brand-950/40',
    iconColor: 'text-brand-600 dark:text-brand-400',
    swatch: 'bg-brand-500',
  },
  red: {
    bar: 'bg-red-400',
    dot: 'bg-red-500',
    chipBg: 'bg-red-50 dark:bg-red-950/40',
    chipText: 'text-red-700 dark:text-red-400',
    iconBg: 'bg-red-50 dark:bg-red-950/40',
    iconColor: 'text-red-600 dark:text-red-400',
    swatch: 'bg-red-500',
  },
  emerald: {
    bar: 'bg-emerald-400',
    dot: 'bg-emerald-500',
    chipBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    chipText: 'text-emerald-700 dark:text-emerald-400',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    swatch: 'bg-emerald-500',
  },
  amber: {
    bar: 'bg-amber-400',
    dot: 'bg-amber-500',
    chipBg: 'bg-amber-50 dark:bg-amber-950/40',
    chipText: 'text-amber-700 dark:text-amber-400',
    iconBg: 'bg-amber-50 dark:bg-amber-950/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    swatch: 'bg-amber-500',
  },
  violet: {
    bar: 'bg-violet-400',
    dot: 'bg-violet-500',
    chipBg: 'bg-violet-50 dark:bg-violet-950/40',
    chipText: 'text-violet-700 dark:text-violet-400',
    iconBg: 'bg-violet-50 dark:bg-violet-950/40',
    iconColor: 'text-violet-600 dark:text-violet-400',
    swatch: 'bg-violet-500',
  },
  pink: {
    bar: 'bg-pink-400',
    dot: 'bg-pink-500',
    chipBg: 'bg-pink-50 dark:bg-pink-950/40',
    chipText: 'text-pink-700 dark:text-pink-400',
    iconBg: 'bg-pink-50 dark:bg-pink-950/40',
    iconColor: 'text-pink-600 dark:text-pink-400',
    swatch: 'bg-pink-500',
  },
  cyan: {
    bar: 'bg-cyan-400',
    dot: 'bg-cyan-500',
    chipBg: 'bg-cyan-50 dark:bg-cyan-950/40',
    chipText: 'text-cyan-700 dark:text-cyan-400',
    iconBg: 'bg-cyan-50 dark:bg-cyan-950/40',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    swatch: 'bg-cyan-500',
  },
};

export const PALETTE_COLORS = Object.keys(COLOR_PALETTE);

export const DEFAULT_CATEGORY = 'general';

// Built-in categories that ship with every family.
export const BUILTIN_CATEGORIES = [
  { id: 'general', label: 'General', color: 'slate' },
  { id: 'family', label: 'Family', color: 'blue' },
  { id: 'health', label: 'Health', color: 'red' },
  { id: 'sports', label: 'Sports', color: 'emerald' },
];

function resolve({ id, label, color }, builtin = false) {
  const palette = COLOR_PALETTE[color] || COLOR_PALETTE.slate;
  return { id, label, color, builtin, ...palette };
}

export const BUILTIN_LIST = BUILTIN_CATEGORIES.map((c) => resolve(c, true));
const BUILTIN_MAP = Object.fromEntries(BUILTIN_LIST.map((c) => [c.id, c]));

export function resolveCategory(raw) {
  if (!raw) return null;
  return resolve(raw);
}

// Merge built-in + family-custom categories into a single resolved list.
// `disabled` is an array of built-in ids the family has chosen to hide.
export function mergeCategories(customRaw = [], disabled = []) {
  const hidden = new Set(disabled);
  const builtins = BUILTIN_LIST.filter((c) => !hidden.has(c.id));
  const customs = customRaw.filter(Boolean).map((c) => resolve(c, false));
  return [...builtins, ...customs];
}

export function getCategoryById(id, customRaw = []) {
  if (BUILTIN_MAP[id]) return BUILTIN_MAP[id];
  const match = customRaw.find((c) => c && c.id === id);
  if (match) return resolve(match, false);
  return BUILTIN_MAP[DEFAULT_CATEGORY];
}
