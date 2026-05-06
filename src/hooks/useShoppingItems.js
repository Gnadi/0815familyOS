import { useEffect, useState } from 'react';
import { subscribeShoppingItems } from '../services/shopping';

export default function useShoppingItems(familyId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) {
      setItems([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeShoppingItems(familyId, (list) => {
      setItems(list);
      setLoading(false);
    });
    return unsub;
  }, [familyId]);

  return { items, loading };
}
