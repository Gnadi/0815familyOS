import { createSharedCollection, useSharedCollection } from './sharedCollection';
import { subscribeShoppingItems } from '../services/shopping';

// One listener per family shared by every caller (see sharedCollection.js).
const store = createSharedCollection(subscribeShoppingItems);

export default function useShoppingItems(familyId) {
  const { data, loading, error } = useSharedCollection(store, familyId);
  return { items: data, loading, error };
}
