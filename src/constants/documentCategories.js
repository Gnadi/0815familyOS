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
  { id: 'academic',  label: 'Academic',  color: 'amber'   },
  { id: 'sports',    label: 'Sports',    color: 'emerald' },
  { id: 'arts',      label: 'Arts',      color: 'violet'  },
  { id: 'swimming',  label: 'Swimming',  color: 'cyan'    },
  { id: 'milestone', label: 'Milestone', color: 'pink'    },
  { id: 'community', label: 'Community', color: 'blue'    },
  { id: 'other',     label: 'Other',     color: 'slate'   },
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
