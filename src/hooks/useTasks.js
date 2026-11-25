import { useMemo } from 'react';
import { createSharedCollection, useSharedCollection } from './sharedCollection';
import { subscribeCompletedTasks, subscribeOpenTasks, subscribeTasksDueBetween } from '../services/tasks';
import { localDayKey } from '../utils/mergedListeners';

// The board's tasks come from two shared listeners (see sharedCollection.js):
// the open tasks, which the board needs to be usable, and the completed
// archive, which only grows and used to hold up the whole page. Both start
// together; the page renders on the open ones and fills the archive in.
const openStore = createSharedCollection(subscribeOpenTasks);
const completedStore = createSharedCollection(subscribeCompletedTasks);

// `loading` covers the open tasks only; `completedLoading` the archive.
// `tasks` is both, deduplicated by id (a task moving between the two queries
// can briefly be reported by both).
export default function useTasks(familyId) {
  const open = useSharedCollection(openStore, familyId);
  const completed = useSharedCollection(completedStore, familyId);
  const tasks = useMemo(() => {
    if (completed.data.length === 0) return open.data;
    if (open.data.length === 0) return completed.data;
    const doneIds = new Set(completed.data.map((t) => t.id));
    return [...open.data.filter((t) => !doneIds.has(t.id)), ...completed.data];
  }, [open.data, completed.data]);
  return {
    tasks,
    loading: open.loading,
    completedLoading: completed.loading,
    error: open.error || completed.error,
  };
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
