import { createSharedCollection, useSharedCollection } from './sharedCollection';
import { subscribeDocuments } from '../services/documents';

// One listener per family shared by every caller (see sharedCollection.js).
const store = createSharedCollection(subscribeDocuments);

export default function useDocuments(familyId) {
  const { data, loading, error } = useSharedCollection(store, familyId);
  return { documents: data, loading, error };
}
