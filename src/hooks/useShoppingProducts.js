import { useEffect, useState } from 'react';
import { subscribeShoppingProducts } from '../services/shoppingProducts';

export default function useShoppingProducts(familyId) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) {
      setProducts([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeShoppingProducts(familyId, (list) => {
      setProducts(list);
      setLoading(false);
    });
    return unsub;
  }, [familyId]);

  return { products, loading };
}
