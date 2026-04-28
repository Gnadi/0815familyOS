import { useEffect, useState } from 'react';
import { subscribeVaccinations } from '../services/vaccinations';

export default function useVaccinations(familyId) {
  const [vaccinations, setVaccinations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) {
      setVaccinations([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeVaccinations(familyId, (list) => {
      setVaccinations(list);
      setLoading(false);
    });
    return unsub;
  }, [familyId]);

  return { vaccinations, loading };
}
