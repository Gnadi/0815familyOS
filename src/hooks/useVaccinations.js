import { createSharedCollection, useSharedCollection } from './sharedCollection';
import { subscribeVaccinations } from '../services/vaccinations';

// One listener per family shared by every caller (see sharedCollection.js).
const store = createSharedCollection(subscribeVaccinations);

export default function useVaccinations(familyId) {
  const { data, loading, error } = useSharedCollection(store, familyId);
  return { vaccinations: data, loading, error };
}
