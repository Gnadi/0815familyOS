import { useEffect, useState } from 'react';
import { subscribeDocuments } from '../services/documents';

export default function useDocuments(familyId) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) {
      setDocuments([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeDocuments(familyId, (list) => {
      setDocuments(list);
      setLoading(false);
    });
    return unsub;
  }, [familyId]);

  return { documents, loading };
}
