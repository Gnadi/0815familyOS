import { COLOR_PALETTE } from './eventCategories';

export const DEFAULT_DOC_CATEGORY = 'other';
export const DEFAULT_TROPHY_CATEGORY = 'other';

export const DOC_CATEGORIES = [
  { id: 'identity',  label: 'Identity',  color: 'blue',    builtin: true },
  { id: 'medical',   label: 'Medical',   color: 'red',     builtin: true },
  { id: 'insurance', label: 'Insurance', color: 'emerald', builtin: true },
  { id: 'finance',   label: 'Finance',   color: 'amber',   builtin: true },
  { id: 'property',  label: 'Property',  color: 'violet',  builtin: true },
  { id: 'school',    label: 'School',    color: 'cyan',    builtin: true },
  { id: 'other',     label: 'Other',     color: 'slate',   builtin: true },
];

export const TROPHY_CATEGORIES = [
  { id: 'academic',  label: 'Academic',  color: 'amber',   builtin: true },
  { id: 'sports',    label: 'Sports',    color: 'emerald', builtin: true },
  { id: 'arts',      label: 'Arts',      color: 'violet',  builtin: true },
  { id: 'swimming',  label: 'Swimming',  color: 'cyan',    builtin: true },
  { id: 'milestone', label: 'Milestone', color: 'pink',    builtin: true },
  { id: 'community', label: 'Community', color: 'blue',    builtin: true },
  { id: 'other',     label: 'Other',     color: 'slate',   builtin: true },
];

// Card background styles for trophy cards, keyed by color name.
const TROPHY_CARD_STYLES = {
  amber:   { cardBg: 'bg-gradient-to-br from-amber-50 to-yellow-50',   cardRing: 'ring-amber-100'   },
  emerald: { cardBg: 'bg-gradient-to-br from-emerald-50 to-green-50',  cardRing: 'ring-emerald-100' },
  violet:  { cardBg: 'bg-gradient-to-br from-violet-50 to-purple-50',  cardRing: 'ring-violet-100'  },
  cyan:    { cardBg: 'bg-gradient-to-br from-cyan-50 to-sky-50',       cardRing: 'ring-cyan-100'    },
  pink:    { cardBg: 'bg-gradient-to-br from-pink-50 to-rose-50',      cardRing: 'ring-pink-100'    },
  blue:    { cardBg: 'bg-gradient-to-br from-blue-50 to-indigo-50',    cardRing: 'ring-blue-100'    },
  slate:   { cardBg: 'bg-gradient-to-br from-slate-50 to-gray-50',     cardRing: 'ring-slate-100'   },
  red:     { cardBg: 'bg-gradient-to-br from-red-50 to-orange-50',     cardRing: 'ring-red-100'     },
};

function resolve(cat) {
  const palette = COLOR_PALETTE[cat.color] || COLOR_PALETTE.slate;
  return { ...cat, ...palette };
}

function resolveTrophy(cat) {
  const palette = COLOR_PALETTE[cat.color] || COLOR_PALETTE.slate;
  const cardStyle = TROPHY_CARD_STYLES[cat.color] || TROPHY_CARD_STYLES.slate;
  return { ...cat, ...palette, ...cardStyle };
}

export const DOC_CATEGORY_LIST    = DOC_CATEGORIES.map(resolve);
export const TROPHY_CATEGORY_LIST = TROPHY_CATEGORIES.map(resolveTrophy);

const DOC_MAP    = Object.fromEntries(DOC_CATEGORY_LIST.map((c) => [c.id, c]));
const TROPHY_MAP = Object.fromEntries(TROPHY_CATEGORY_LIST.map((c) => [c.id, c]));

export function getDocCategory(id) {
  return DOC_MAP[id] || DOC_MAP[DEFAULT_DOC_CATEGORY];
}

export function getTrophyCategory(id) {
  return TROPHY_MAP[id] || TROPHY_MAP[DEFAULT_TROPHY_CATEGORY];
}

export function mergeDocCategories(customRaw = [], disabled = []) {
  const hidden = new Set(disabled);
  const builtins = DOC_CATEGORY_LIST.filter((c) => !hidden.has(c.id));
  const customs = customRaw.filter(Boolean).map((c) => resolve(c));
  return [...builtins, ...customs];
}

export function mergeTrophyCategories(customRaw = [], disabled = []) {
  const hidden = new Set(disabled);
  const builtins = TROPHY_CATEGORY_LIST.filter((c) => !hidden.has(c.id));
  const customs = customRaw.filter(Boolean).map((c) => resolveTrophy(c));
  return [...builtins, ...customs];
}

export function getDocCategoryDynamic(id, customRaw = []) {
  if (DOC_MAP[id]) return DOC_MAP[id];
  const match = customRaw.find((c) => c && c.id === id);
  if (match) return resolve(match);
  return DOC_MAP[DEFAULT_DOC_CATEGORY];
}

export function getTrophyCategoryDynamic(id, customRaw = []) {
  if (TROPHY_MAP[id]) return TROPHY_MAP[id];
  const match = customRaw.find((c) => c && c.id === id);
  if (match) return resolveTrophy(match);
  return TROPHY_MAP[DEFAULT_TROPHY_CATEGORY];
}
