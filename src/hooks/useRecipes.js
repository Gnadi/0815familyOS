import { createSharedCollection, useSharedCollection } from './sharedCollection';
import { subscribeRecipes } from '../services/recipes';

// One listener per family shared by every caller (see sharedCollection.js).
const store = createSharedCollection(subscribeRecipes);

export default function useRecipes(familyId) {
  const { data, loading, error } = useSharedCollection(store, familyId);
  return { recipes: data, loading, error };
}
