import { useEffect, useState } from 'react';
import { subscribeRecipes } from '../services/recipes';

export default function useRecipes(familyId) {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) {
      setRecipes([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeRecipes(familyId, (list) => {
      setRecipes(list);
      setLoading(false);
    });
    return unsub;
  }, [familyId]);

  return { recipes, loading };
}
