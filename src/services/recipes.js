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
import { db } from '../lib/firebase';
import { DEFAULT_RECIPE_CATEGORY } from '../constants/recipeCategories';

const recipesRef = collection(db, 'recipes');

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

export function subscribeRecipes(familyId, cb) {
  const q = query(recipesRef, where('familyId', '==', familyId));
  return onSnapshot(q, (snap) => {
    const list = snap.docs
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
          notes: data.notes || '',
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        };
      })
      .sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
      );
    cb(list);
  });
}

export function createRecipe({
  familyId,
  userId,
  title,
  sourceUrl,
  ingredients,
  instructions,
  category,
  notes,
}) {
  return addDoc(recipesRef, {
    familyId,
    userId,
    title: title.trim(),
    sourceUrl: normalizeUrl(sourceUrl),
    ingredients: toList(ingredients),
    instructions: toList(instructions),
    category: category || DEFAULT_RECIPE_CATEGORY,
    notes: (notes || '').trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateRecipe(id, { title, sourceUrl, ingredients, instructions, category, notes }) {
  return updateDoc(doc(db, 'recipes', id), {
    title: title.trim(),
    sourceUrl: normalizeUrl(sourceUrl),
    ingredients: toList(ingredients),
    instructions: toList(instructions),
    category: category || DEFAULT_RECIPE_CATEGORY,
    notes: (notes || '').trim(),
    updatedAt: serverTimestamp(),
  });
}

export function deleteRecipe(id) {
  return deleteDoc(doc(db, 'recipes', id));
}
