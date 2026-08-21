import { useEffect, useState } from 'react';
import { subscribeEvents } from '../services/events';

export default function useEvents(familyId) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!familyId) {
      setEvents([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError(null);
    const unsub = subscribeEvents(
      familyId,
      (list) => {
        setEvents(list);
        setError(null);
        setLoading(false);
      },
      // A failed listener has to end the loading state too, otherwise the
      // calendar shows "loading events" indefinitely with no way out.
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsub;
  }, [familyId]);

  return { events, loading, error };
}
