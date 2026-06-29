import { useEffect, useState } from 'react';
import { subscribeMealPlan } from '../services/mealPlan';

export default function useMealPlan(familyId) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) {
      setEntries([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeMealPlan(familyId, (list) => {
      setEntries(list);
      setLoading(false);
    });
    return unsub;
  }, [familyId]);

  return { entries, loading };
}
