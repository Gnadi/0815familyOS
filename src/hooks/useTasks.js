import { createSharedCollection, useSharedCollection } from './sharedCollection';
import { subscribeTasks, subscribeTasksDueBetween } from '../services/tasks';
import { localDayKey } from '../utils/mergedListeners';

// One listener per family shared by every caller (see sharedCollection.js).
const store = createSharedCollection(subscribeTasks);

export default function useTasks(familyId) {
  const { data, loading, error } = useSharedCollection(store, familyId);
  return { tasks: data, loading, error };
}

// Tasks due on one calendar day, keyed `familyId|YYYY-MM-DD`. The Dashboard
// only lists today's open tasks; the full list (and its growing archive of
// completed tasks) stays with the Tasks page.
const dueStore = createSharedCollection((key, onData, onError) => {
  const [familyId, day] = key.split('|');
  const [y, m, d] = day.split('-').map(Number);
  return subscribeTasksDueBetween(familyId, new Date(y, m - 1, d), new Date(y, m - 1, d + 1), onData, onError);
});

export function useTasksDueOn(familyId, day = new Date()) {
  const key = familyId ? `${familyId}|${localDayKey(day)}` : null;
  const { data, loading, error } = useSharedCollection(dueStore, key);
  return { tasks: data, loading, error };
}
