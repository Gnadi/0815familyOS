// Hardcoded Tailwind class names (no string interpolation) so Tailwind's
// content-scan keeps them in the production build.
export const CATEGORIES = {
  general: {
    id: 'general',
    label: 'General',
    bar: 'bg-slate-400',
    dot: 'bg-slate-400',
    chipBg: 'bg-slate-100',
    chipText: 'text-slate-700',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
  },
  family: {
    id: 'family',
    label: 'Family',
    bar: 'bg-brand-500',
    dot: 'bg-brand-500',
    chipBg: 'bg-brand-50',
    chipText: 'text-brand-700',
    iconBg: 'bg-brand-50',
    iconColor: 'text-brand-600',
  },
  health: {
    id: 'health',
    label: 'Health',
    bar: 'bg-red-400',
    dot: 'bg-red-500',
    chipBg: 'bg-red-50',
    chipText: 'text-red-700',
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
  },
  sports: {
    id: 'sports',
    label: 'Sports',
    bar: 'bg-emerald-400',
    dot: 'bg-emerald-500',
    chipBg: 'bg-emerald-50',
    chipText: 'text-emerald-700',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  school: {
    id: 'school',
    label: 'School',
    bar: 'bg-amber-400',
    dot: 'bg-amber-500',
    chipBg: 'bg-amber-50',
    chipText: 'text-amber-700',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  social: {
    id: 'social',
    label: 'Social',
    bar: 'bg-violet-400',
    dot: 'bg-violet-500',
    chipBg: 'bg-violet-50',
    chipText: 'text-violet-700',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);
export const DEFAULT_CATEGORY = 'general';

export function getCategory(id) {
  return CATEGORIES[id] || CATEGORIES[DEFAULT_CATEGORY];
}
