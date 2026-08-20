import { useEffect, useState } from 'react';
import { subscribeTrackerEntries, subscribeTrackers } from '../services/trackers';

// Definitions and their logged entries always arrive together: a card cannot
// render "last time" without both, and two separate hooks would make the page
// flash a wrong "never logged" state between the snapshots.
export default function useTrackers(familyId) {
  const [trackers, setTrackers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) {
      setTrackers([]);
      setEntries([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    let gotTrackers = false;
    let gotEntries = false;
    const settle = () => {
      if (gotTrackers && gotEntries) setLoading(false);
    };

    const unsubTrackers = subscribeTrackers(familyId, (list) => {
      setTrackers(list);
      gotTrackers = true;
      settle();
    });
    const unsubEntries = subscribeTrackerEntries(familyId, (list) => {
      setEntries(list);
      gotEntries = true;
      settle();
    });

    return () => {
      unsubTrackers();
      unsubEntries();
    };
  }, [familyId]);

  return { trackers, entries, loading };
}
