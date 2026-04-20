import { useEffect, useState } from 'react';
import { subscribeEvents } from '../services/events';

export default function useEvents(familyId) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) {
      setEvents([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeEvents(familyId, (list) => {
      setEvents(list);
      setLoading(false);
    });
    return unsub;
  }, [familyId]);

  return { events, loading };
}
