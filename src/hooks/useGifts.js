import { useEffect, useState } from 'react';
import { subscribeGifts } from '../services/gifts';

export default function useGifts(familyId) {
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) {
      setGifts([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeGifts(familyId, (list) => {
      setGifts(list);
      setLoading(false);
    });
    return unsub;
  }, [familyId]);

  return { gifts, loading };
}
