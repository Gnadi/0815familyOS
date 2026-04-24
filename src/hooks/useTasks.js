import { useEffect, useState } from 'react';
import { subscribeTasks } from '../services/tasks';

export default function useTasks(familyId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) {
      setTasks([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeTasks(familyId, (list) => {
      setTasks(list);
      setLoading(false);
    });
    return unsub;
  }, [familyId]);

  return { tasks, loading };
}
