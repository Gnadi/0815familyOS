import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { authorizationHeader, db } from '../lib/firebase';
import { DEFAULT_RECIPE_CATEGORY } from '../constants/recipeCategories';
import { isDemoMode } from '../lib/demoMode';
import { demoAdd, demoDelete, demoSubscribe, demoUpdate } from './demoStore';

const recipesRef = collection(db, 'recipes');

const nowVal = () => (isDemoMode() ? new Date() : serverTimestamp());

function toDate(value) {
  if (!value) return null;
  return value?.toDate ? value.toDate() : value;
}

// Ensure a pasted link has a scheme so <a href> / window.open work. Leaves
// empty strings untouched (the source URL is optional).
function normalizeUrl(url) {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// Normalize ingredients/steps to an array of non-empty trimmed strings.
// Accepts the new array shape as well as the legacy newline-joined string,
// so older recipes keep working without a migration.
export function toList(value) {
  const arr = Array.isArray(value) ? value : String(value || '').split('\n');
  return arr.map((s) => String(s).trim()).filter(Boolean);
}

// How many portions the recipe as written makes; null when not given. Used to
// scale planned meals to the household (utils/household.js).
const MAX_SERVINGS = 100;

export function normalizeServings(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= MAX_SERVINGS ? n : null;
}

function mapRecipeDocs(docs) {
  return docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        title: data.title || '',
        sourceUrl: data.sourceUrl || '',
        ingredients: toList(data.ingredients),
        instructions: toList(data.instructions),
        category: data.category || DEFAULT_RECIPE_CATEGORY,
        servings: normalizeServings(data.servings),
        notes: data.notes || '',
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
      };
    })
    .sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
    );
}

export function subscribeRecipes(familyId, cb) {
  if (isDemoMode()) return demoSubscribe('recipes', (docs) => cb(mapRecipeDocs(docs)));
  const q = query(recipesRef, where('familyId', '==', familyId));
  return onSnapshot(q, (snap) => cb(mapRecipeDocs(snap.docs)));
}

export function createRecipe({
  familyId,
  userId,
  title,
  sourceUrl,
  ingredients,
  instructions,
  category,
  servings,
  notes,
}) {
  const payload = {
    familyId,
    userId,
    title: title.trim(),
    sourceUrl: normalizeUrl(sourceUrl),
    ingredients: toList(ingredients),
    instructions: toList(instructions),
    category: category || DEFAULT_RECIPE_CATEGORY,
    servings: normalizeServings(servings),
    notes: (notes || '').trim(),
    createdAt: nowVal(),
    updatedAt: nowVal(),
  };
  if (isDemoMode()) return demoAdd('recipes', payload);
  return addDoc(recipesRef, payload);
}

export function updateRecipe(id, { title, sourceUrl, ingredients, instructions, category, servings, notes }) {
  const payload = {
    title: title.trim(),
    sourceUrl: normalizeUrl(sourceUrl),
    ingredients: toList(ingredients),
    instructions: toList(instructions),
    category: category || DEFAULT_RECIPE_CATEGORY,
    servings: normalizeServings(servings),
    notes: (notes || '').trim(),
    updatedAt: nowVal(),
  };
  if (isDemoMode()) return demoUpdate('recipes', id, payload);
  return updateDoc(doc(db, 'recipes', id), payload);
}

export function deleteRecipe(id) {
  if (isDemoMode()) return demoDelete('recipes', id);
  return deleteDoc(doc(db, 'recipes', id));
}

// Read a recipe from a recipe page (Cookidoo, Chefkoch, …) through
// api/recipe-import.js. Resolves to the form's fields -- title, ingredients,
// instructions, servings, category (null when the site's didn't match one of
// ours) and sourceUrl -- and rejects with an Error whose `code` is 'no-recipe'
// when the page describes no recipe and 'blocked' when the site refused us.
export async function importRecipeFromUrl(url) {
  const res = await fetch('/api/recipe-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authorizationHeader()) },
    body: JSON.stringify({ url }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.recipe) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.code = data?.code || null;
    throw err;
  }
  return data.recipe;
}
