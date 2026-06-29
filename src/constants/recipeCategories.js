import { COLOR_PALETTE } from './eventCategories';

// Fixed set of recipe categories. Colors reference the shared palette in
// eventCategories.js so chips render consistently with the rest of the app.
export const RECIPE_CATEGORIES = [
  { id: 'breakfast', label: 'Breakfast', labelKey: 'recipeCat.breakfast', color: 'amber' },
  { id: 'lunch', label: 'Lunch', labelKey: 'recipeCat.lunch', color: 'emerald' },
  { id: 'dinner', label: 'Dinner', labelKey: 'recipeCat.dinner', color: 'blue' },
  { id: 'dessert', label: 'Dessert', labelKey: 'recipeCat.dessert', color: 'pink' },
  { id: 'snack', label: 'Snack', labelKey: 'recipeCat.snack', color: 'violet' },
  { id: 'drinks', label: 'Drinks', labelKey: 'recipeCat.drinks', color: 'cyan' },
  { id: 'other', label: 'Other', labelKey: 'recipeCat.other', color: 'slate' },
];

export const DEFAULT_RECIPE_CATEGORY = 'other';

const MAP = Object.fromEntries(RECIPE_CATEGORIES.map((c) => [c.id, c]));

export function getRecipeCategory(id) {
  const cat = MAP[id] || MAP[DEFAULT_RECIPE_CATEGORY];
  return { ...cat, ...(COLOR_PALETTE[cat.color] || COLOR_PALETTE.slate) };
}
