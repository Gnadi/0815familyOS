// Hardcoded Tailwind class names (no string interpolation) so Tailwind's
// content scan keeps them in the production build.

// Fixed palette users can choose from when creating a custom category.
export const COLOR_PALETTE = {
  slate: {
    bar: 'bg-slate-400',
    dot: 'bg-slate-400',
    chipBg: 'bg-slate-100',
    chipText: 'text-slate-700',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    swatch: 'bg-slate-400',
  },
  blue: {
    bar: 'bg-brand-500',
    dot: 'bg-brand-500',
    chipBg: 'bg-brand-50',
    chipText: 'text-brand-700',
    iconBg: 'bg-brand-50',
    iconColor: 'text-brand-600',
    swatch: 'bg-brand-500',
  },
  red: {
    bar: 'bg-red-400',
    dot: 'bg-red-500',
    chipBg: 'bg-red-50',
    chipText: 'text-red-700',
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    swatch: 'bg-red-500',
  },
  emerald: {
    bar: 'bg-emerald-400',
    dot: 'bg-emerald-500',
    chipBg: 'bg-emerald-50',
    chipText: 'text-emerald-700',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    swatch: 'bg-emerald-500',
  },
  amber: {
    bar: 'bg-amber-400',
    dot: 'bg-amber-500',
    chipBg: 'bg-amber-50',
    chipText: 'text-amber-700',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    swatch: 'bg-amber-500',
  },
  violet: {
    bar: 'bg-violet-400',
    dot: 'bg-violet-500',
    chipBg: 'bg-violet-50',
    chipText: 'text-violet-700',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    swatch: 'bg-violet-500',
  },
  pink: {
    bar: 'bg-pink-400',
    dot: 'bg-pink-500',
    chipBg: 'bg-pink-50',
    chipText: 'text-pink-700',
    iconBg: 'bg-pink-50',
    iconColor: 'text-pink-600',
    swatch: 'bg-pink-500',
  },
  cyan: {
    bar: 'bg-cyan-400',
    dot: 'bg-cyan-500',
    chipBg: 'bg-cyan-50',
    chipText: 'text-cyan-700',
    iconBg: 'bg-cyan-50',
    iconColor: 'text-cyan-600',
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

function resolve({ id, label, color }) {
  const palette = COLOR_PALETTE[color] || COLOR_PALETTE.slate;
  return { id, label, color, ...palette };
}

export const BUILTIN_LIST = BUILTIN_CATEGORIES.map(resolve);
const BUILTIN_MAP = Object.fromEntries(BUILTIN_LIST.map((c) => [c.id, c]));

export function resolveCategory(raw) {
  if (!raw) return null;
  return resolve(raw);
}

// Merge built-in + family-custom categories into a single resolved list.
export function mergeCategories(customRaw = []) {
  const customs = customRaw.filter(Boolean).map(resolve);
  return [...BUILTIN_LIST, ...customs];
}

export function getCategoryById(id, customRaw = []) {
  if (BUILTIN_MAP[id]) return BUILTIN_MAP[id];
  const match = customRaw.find((c) => c && c.id === id);
  if (match) return resolve(match);
  return BUILTIN_MAP[DEFAULT_CATEGORY];
}
