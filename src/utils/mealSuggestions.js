// Which of the family's own recipes to cook in a week, and on which days.
//
// The weekly proposal asks how many meals the family wants to cook that week
// and fills what is not planned yet from its recipes (docs/smart-shopping.md).
// Pure, like the rest of the smart list, so it is unit-tested.

import { addDays, startOfDay } from 'date-fns';

const DAY = 24 * 60 * 60 * 1000;

// Meals, not desserts, snacks or drinks.
const MEAL_CATEGORIES = new Set(['breakfast', 'lunch', 'dinner', 'other']);

// A recipe planned this close to the week (before or after it) is "recent"
// and only suggested when nothing else is left.
export const RECENT_DAYS = 14;

// Below this many recipes a week cannot be suggested without repeating, so
// nothing is suggested automatically — the family picks recipes itself.
export const MIN_RECIPES_TO_SUGGEST = 7;

// Stable per-week tie-breaker: recipes that are equally due come in a
// different order each week instead of alphabetically every time.
function hash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return h >>> 0;
}

// The family's recipes in the order to suggest them for the week [from, to):
// longest not planned first, so suggestions rotate through the collection.
// Each row says when the recipe was last planned before the week, and whether
// it is planned close to the week on either side.
export function rankRecipes({ recipes = [], entries = [], from, to, seed = '' }) {
  const recentFrom = from.getTime() - RECENT_DAYS * DAY;
  const recentTo = to.getTime() + RECENT_DAYS * DAY;
  const last = new Map();
  const recent = new Set();
  for (const e of entries) {
    if (!e.recipeId || !e.date) continue;
    const time = e.date.getTime();
    if (time < from.getTime() && time > (last.get(e.recipeId)?.getTime() ?? -Infinity)) {
      last.set(e.recipeId, e.date);
    }
    if ((time >= recentFrom && time < from.getTime()) || (time >= to.getTime() && time < recentTo)) {
      recent.add(e.recipeId);
    }
  }
  return recipes
    .filter((r) => MEAL_CATEGORIES.has(r.category || 'other'))
    .map((recipe) => ({
      recipe,
      lastPlanned: last.get(recipe.id) || null,
      recent: recent.has(recipe.id),
    }))
    .sort(
      (a, b) =>
        Number(a.recent) - Number(b.recent) ||
        (a.lastPlanned?.getTime() ?? 0) - (b.lastPlanned?.getTime() ?? 0) ||
        hash(seed + a.recipe.id) - hash(seed + b.recipe.id),
    );
}

// The next `count` recipes from the ranking that are not excluded (already
// planned this week, or already chosen).
export function suggestMeals({ ranked = [], exclude = new Set(), count }) {
  if (!(count > 0)) return [];
  return ranked
    .filter(({ recipe }) => !exclude.has(recipe.id))
    .slice(0, count)
    .map(({ recipe }) => recipe);
}

// Where a recipe is eaten: breakfast and lunch recipes in their slot,
// everything else for dinner.
const SLOT_FOR_CATEGORY = { breakfast: 'breakfast', lunch: 'lunch' };
const SLOT_ORDER = ['dinner', 'lunch', 'breakfast'];

// Put chosen recipes on free days of the week [from, from + 7): the first day
// whose slot is still empty, preferring the recipe's own slot. A recipe that
// finds no free slot at all (a fully planned week) is left out.
export function placeMeals({ recipes = [], entries = [], from }) {
  const start = startOfDay(from);
  const end = addDays(start, 7);
  const cellKey = (date, slot) => `${startOfDay(date).getTime()}|${slot}`;
  const taken = new Set(
    entries.filter((e) => e.date && e.date >= start && e.date < end).map((e) => cellKey(e.date, e.slot)),
  );

  const placed = [];
  for (const recipe of recipes) {
    const preferred = SLOT_FOR_CATEGORY[recipe.category] || 'dinner';
    const slots = [preferred, ...SLOT_ORDER.filter((s) => s !== preferred)];
    let spot = null;
    for (const slot of slots) {
      for (let i = 0; i < 7 && !spot; i += 1) {
        const date = addDays(start, i);
        if (!taken.has(cellKey(date, slot))) spot = { date, slot };
      }
      if (spot) break;
    }
    if (!spot) continue;
    taken.add(cellKey(spot.date, spot.slot));
    placed.push({ recipe, ...spot });
  }
  return placed;
}
