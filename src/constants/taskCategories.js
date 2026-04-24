// Task-specific categories. Re-uses the shared COLOR_PALETTE from
// eventCategories so the design language stays consistent across the app.
import { COLOR_PALETTE } from './eventCategories';

export const DEFAULT_TASK_CATEGORY = 'general';

export const TASK_CATEGORIES = [
  { id: 'maintenance',  label: 'Maintenance',  color: 'amber'   },
  { id: 'urgent',       label: 'Urgent',       color: 'red'     },
  { id: 'procurement',  label: 'Procurement',  color: 'blue'    },
  { id: 'finance',      label: 'Finance',      color: 'emerald' },
  { id: 'general',      label: 'General',      color: 'slate'   },
];

function resolve(cat) {
  const palette = COLOR_PALETTE[cat.color] || COLOR_PALETTE.slate;
  return { ...cat, ...palette };
}

export const TASK_CATEGORY_LIST = TASK_CATEGORIES.map(resolve);
const TASK_CATEGORY_MAP = Object.fromEntries(
  TASK_CATEGORY_LIST.map((c) => [c.id, c])
);

export function getTaskCategory(id) {
  return TASK_CATEGORY_MAP[id] || TASK_CATEGORY_MAP[DEFAULT_TASK_CATEGORY];
}

export const TASK_STATUSES = [
  { id: 'backlog',    label: 'Backlog'     },
  { id: 'planned',    label: 'Planned'     },
  { id: 'inProgress', label: 'In Progress' },
  { id: 'completed',  label: 'Completed'   },
];

export const SPRINT_STATUSES = ['planned', 'inProgress', 'completed'];

export const TASK_PRIORITIES = [
  { id: 'low',     label: 'Low',     dot: 'bg-slate-400'  },
  { id: 'normal',  label: 'Normal',  dot: 'bg-brand-400'  },
  { id: 'high',    label: 'High',    dot: 'bg-amber-500'  },
  { id: 'urgent',  label: 'Urgent',  dot: 'bg-red-500'    },
];

export const TASK_PRIORITY_MAP = Object.fromEntries(
  TASK_PRIORITIES.map((p) => [p.id, p])
);
