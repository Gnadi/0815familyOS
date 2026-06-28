import { COLOR_PALETTE } from './eventCategories';

// Fixed set of recipe categories. Colors reference the shared palette in
// eventCategories.js so chips render consistently with the rest of the app.
export const RECIPE_CATEGORIES = [
  { id: 'breakfast', label: 'Breakfast', color: 'amber' },
  { id: 'lunch', label: 'Lunch', color: 'emerald' },
  { id: 'dinner', label: 'Dinner', color: 'blue' },
  { id: 'dessert', label: 'Dessert', color: 'pink' },
  { id: 'snack', label: 'Snack', color: 'violet' },
  { id: 'drinks', label: 'Drinks', color: 'cyan' },
  { id: 'other', label: 'Other', color: 'slate' },
];

export const DEFAULT_RECIPE_CATEGORY = 'other';

const MAP = Object.fromEntries(RECIPE_CATEGORIES.map((c) => [c.id, c]));

export function getRecipeCategory(id) {
  const cat = MAP[id] || MAP[DEFAULT_RECIPE_CATEGORY];
  return { ...cat, ...(COLOR_PALETTE[cat.color] || COLOR_PALETTE.slate) };
}
