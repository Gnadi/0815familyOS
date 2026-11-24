import { createSharedCollection, useSharedCollection } from './sharedCollection';
import { subscribeShoppingProducts } from '../services/shoppingProducts';

// One listener per family shared by every caller (see sharedCollection.js).
const store = createSharedCollection(subscribeShoppingProducts);

export default function useShoppingProducts(familyId) {
  const { data, loading, error } = useSharedCollection(store, familyId);
  return { products: data, loading, error };
}
