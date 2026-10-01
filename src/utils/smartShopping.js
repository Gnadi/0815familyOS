// Smart shopping: turning purchase rhythms, the meal plan and the household
// into suggestions and a weekly proposal. See docs/smart-shopping.md.
//
// Pure on purpose, like planShoppingAdditions: the review modal renders
// exactly what the write will then carry out, and all of it is unit-tested.

import { addDays, startOfDay } from 'date-fns';
import { joinQuantities, normalizeTitle, parseIngredient, scaleIngredient } from './ingredients';
import { guessProductIcon } from './productIcons';
import { predictProduct } from './consumption';

// --- Products ----------------------------------------------------------------

export function productKey(title) {
  return normalizeTitle(title);
}

// One document per product and family. The family id comes first so the
// rules can check that a product document belongs to the family it names;
// encodeURIComponent keeps "/" and friends out of the document id.
export function productDocId(familyId, key) {
  return `${familyId}_${encodeURIComponent(key)}`;
}

// Products that rarely last a whole week. In weekly mode these go on the
// "in between" list by default. Keyed on the product icon so the bilingual
// keyword table in productIcons.js stays the single place that knows what a
// product is; a family overrides the guess per product.
const FRESH_ICONS = new Set([
  '🍞', '🥐', '🥖', '🥛', '🥩', '🍗', '🐟', '🦐', '🍤', '🥬', '🍅', '🥦',
  '🥒', '🍌', '🍇', '🍓', '🍑', '🍒', '🍄', '🥑',
]);

export function isFreshProduct(title, override = null) {
  if (typeof override === 'boolean') return override;
  return FRESH_ICONS.has(guessProductIcon(title));
}

// --- Dates -------------------------------------------------------------------

// Start of the next shopping day; today counts if today is the day.
export function nextShoppingDate(now, shoppingDay) {
  const day = startOfDay(now);
  return addDays(day, (shoppingDay - day.getDay() + 7) % 7);
}

// How far ahead "due soon" looks in the running-list mode.
export const CONTINUOUS_HORIZON_DAYS = 2;

// --- Matching against the list ----------------------------------------------

// Open items and "recently used" tiles by product key. Several tiles can share
// a title; the most recently completed one is the one the family last touched.
export function indexShoppingItems(items = []) {
  const openByKey = new Map();
  const doneByKey = new Map();
  for (const item of items) {
    const key = productKey(item.title);
    if (!key) continue;
    if (item.done) {
      const current = doneByKey.get(key);
      const better =
        !current ||
        (item.completedAt?.getTime?.() || 0) > (current.completedAt?.getTime?.() || 0);
      if (better) doneByKey.set(key, item);
    } else {
      openByKey.set(key, item);
    }
  }
  return { openByKey, doneByKey };
}

// What adding a product would do: nothing (already open), bring back its
// "recently used" tile (keeps the icon and flags the family set), or create it.
export function resolveExisting(key, index) {
  const open = index.openByKey.get(key);
  if (open) return { action: 'skip', existingId: open.id };
  const done = index.doneByKey.get(key);
  if (done) return { action: 'reactivate', existingId: done.id };
  return { action: 'create', existingId: null };
}

// --- Predictions -------------------------------------------------------------

// Products the rhythm says run out before `until`, soonest first. Muted
// products never appear; the family switched their suggestions off.
export function dueProducts({ products = [], now = new Date(), until }) {
  return products
    .filter((p) => p && !p.muted && p.key)
    .map((product) => ({ product, prediction: predictProduct(product, now) }))
    .filter(({ prediction }) => prediction.status === 'predicted' && prediction.dueAt < until)
    .sort((a, b) => a.prediction.dueAt - b.prediction.dueAt);
}

// Suggestions shown on the list itself: due before `until` and not already
// waiting on the list.
export function shoppingSuggestions({ products, items, now = new Date(), until }) {
  const { openByKey } = indexShoppingItems(items);
  return dueProducts({ products, now, until }).filter(({ product }) => !openByKey.has(product.key));
}

// --- Meal plan ---------------------------------------------------------------

// Ingredient lines of every recipe planned in [from, to), scaled from the
// recipe's servings to the household's portions. A recipe without servings is
// taken as written — there is nothing to scale from.
export function mealPlanLines({ entries = [], recipes = [], from, to, portions, decimalSeparator }) {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const lines = [];
  for (const entry of entries) {
    if (!entry.recipeId || !entry.date || entry.date < from || entry.date >= to) continue;
    const recipe = byId.get(entry.recipeId);
    if (!recipe) continue;
    const factor = recipe.servings && portions ? portions / recipe.servings : 1;
    for (const line of recipe.ingredients || []) {
      lines.push({
        line: scaleIngredient(line, factor, { decimalSeparator }),
        source: recipe.title,
      });
    }
  }
  return lines;
}

// --- Weekly proposal ---------------------------------------------------------

// Everything the next weekly shop should cover: what runs out before the shop
// after it, and what the meals planned for that week need. Each entry carries
// why it is there (`reasons`), and the same `action` / `existingId` shape as
// planShoppingAdditions so addShoppingItemsBulk can write it.
export function planWeeklyProposal({ products = [], items = [], mealLines = [], tripDate, now = new Date() }) {
  const until = addDays(tripDate, 7);
  const index = indexShoppingItems(items);
  const byKey = new Map();

  const entryFor = (key, title) => {
    let entry = byKey.get(key);
    if (!entry) {
      entry = { key, title, quantities: [], count: 0, sources: new Set(), due: null };
      byKey.set(key, entry);
    }
    return entry;
  };

  for (const { line, source } of mealLines) {
    const { quantity, title } = parseIngredient(line);
    const key = productKey(title);
    if (!key) continue;
    const entry = entryFor(key, title);
    entry.count += 1;
    entry.quantities.push(quantity);
    if (source) entry.sources.add(source);
  }

  for (const { product, prediction } of dueProducts({ products, now, until })) {
    const entry = entryFor(product.key, product.title || product.key);
    entry.due = prediction;
  }

  const order = (e) => (e.dueAt ? e.dueAt.getTime() : Number.MAX_SAFE_INTEGER);
  return [...byKey.values()]
    .map((entry) => {
      const reasons = [];
      if (entry.due) reasons.push('due');
      if (entry.sources.size || entry.count) reasons.push('recipe');
      return {
        key: entry.key,
        title: entry.title,
        quantity: joinQuantities(entry.quantities),
        count: entry.count,
        reasons,
        sources: [...entry.sources],
        dueAt: entry.due?.dueAt || null,
        intervalDays: entry.due?.intervalDays || null,
        lastBought: entry.due?.lastBought || null,
        ...resolveExisting(entry.key, index),
      };
    })
    .sort((a, b) => order(a) - order(b) || a.title.localeCompare(b.title));
}
