import { createSharedCollection, useSharedCollection } from './sharedCollection';
import { subscribeGifts } from '../services/gifts';

// One listener per family shared by every caller (see sharedCollection.js).
const store = createSharedCollection(subscribeGifts);

export default function useGifts(familyId) {
  const { data, loading, error } = useSharedCollection(store, familyId);
  return { gifts: data, loading, error };
}
