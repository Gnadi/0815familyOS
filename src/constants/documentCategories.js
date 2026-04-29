import { COLOR_PALETTE } from './eventCategories';

export const DEFAULT_DOC_CATEGORY = 'other';
export const DEFAULT_TROPHY_CATEGORY = 'other';

export const DOC_CATEGORIES = [
  { id: 'identity',  label: 'Identity',  color: 'blue'    },
  { id: 'medical',   label: 'Medical',   color: 'red'     },
  { id: 'insurance', label: 'Insurance', color: 'emerald' },
  { id: 'finance',   label: 'Finance',   color: 'amber'   },
  { id: 'property',  label: 'Property',  color: 'violet'  },
  { id: 'school',    label: 'School',    color: 'cyan'    },
  { id: 'other',     label: 'Other',     color: 'slate'   },
];

export const TROPHY_CATEGORIES = [
  { id: 'academic',  label: 'Academic',  color: 'amber',   cardBg: 'bg-gradient-to-br from-amber-50 to-yellow-50',   cardRing: 'ring-amber-100'   },
  { id: 'sports',    label: 'Sports',    color: 'emerald', cardBg: 'bg-gradient-to-br from-emerald-50 to-green-50',  cardRing: 'ring-emerald-100' },
  { id: 'arts',      label: 'Arts',      color: 'violet',  cardBg: 'bg-gradient-to-br from-violet-50 to-purple-50',  cardRing: 'ring-violet-100'  },
  { id: 'swimming',  label: 'Swimming',  color: 'cyan',    cardBg: 'bg-gradient-to-br from-cyan-50 to-sky-50',       cardRing: 'ring-cyan-100'    },
  { id: 'milestone', label: 'Milestone', color: 'pink',    cardBg: 'bg-gradient-to-br from-pink-50 to-rose-50',      cardRing: 'ring-pink-100'    },
  { id: 'community', label: 'Community', color: 'blue',    cardBg: 'bg-gradient-to-br from-blue-50 to-indigo-50',    cardRing: 'ring-blue-100'    },
  { id: 'other',     label: 'Other',     color: 'slate',   cardBg: 'bg-gradient-to-br from-slate-50 to-gray-50',     cardRing: 'ring-slate-100'   },
];

function resolve(cat) {
  const palette = COLOR_PALETTE[cat.color] || COLOR_PALETTE.slate;
  return { ...cat, ...palette };
}

export const DOC_CATEGORY_LIST = DOC_CATEGORIES.map(resolve);
export const TROPHY_CATEGORY_LIST = TROPHY_CATEGORIES.map(resolve);

const DOC_MAP = Object.fromEntries(DOC_CATEGORY_LIST.map((c) => [c.id, c]));
const TROPHY_MAP = Object.fromEntries(TROPHY_CATEGORY_LIST.map((c) => [c.id, c]));

export function getDocCategory(id) {
  return DOC_MAP[id] || DOC_MAP[DEFAULT_DOC_CATEGORY];
}

export function getTrophyCategory(id) {
  return TROPHY_MAP[id] || TROPHY_MAP[DEFAULT_TROPHY_CATEGORY];
}
