import { createSharedCollection, useSharedCollection } from './sharedCollection';
import { subscribeTasks } from '../services/tasks';

// One listener per family shared by every caller (see sharedCollection.js).
const store = createSharedCollection(subscribeTasks);

export default function useTasks(familyId) {
  const { data, loading, error } = useSharedCollection(store, familyId);
  return { tasks: data, loading, error };
}
