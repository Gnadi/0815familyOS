import { createSharedCollection, useSharedCollection } from './sharedCollection';
import { subscribeMealPlan } from '../services/mealPlan';

// One listener per family shared by every caller (see sharedCollection.js).
const store = createSharedCollection(subscribeMealPlan);

export default function useMealPlan(familyId) {
  const { data, loading, error } = useSharedCollection(store, familyId);
  return { entries: data, loading, error };
}
