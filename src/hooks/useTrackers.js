import { createSharedCollection, useSharedCollection } from './sharedCollection';
import { subscribeTrackerEntries, subscribeTrackers } from '../services/trackers';

// Shared listeners (see sharedCollection.js): the Dashboard widget and the
// Tracker page reuse one subscription instead of re-querying on every visit.
const trackerStore = createSharedCollection(subscribeTrackers);
const entryStore = createSharedCollection(subscribeTrackerEntries);

// Definitions and their logged entries always arrive together: a card cannot
// render "last time" without both, and two separate loading flags would make
// the page flash a wrong "never logged" state between the snapshots.
export default function useTrackers(familyId) {
  const trackers = useSharedCollection(trackerStore, familyId);
  const entries = useSharedCollection(entryStore, familyId);
  return {
    trackers: trackers.data,
    entries: entries.data,
    loading: trackers.loading || entries.loading,
    error: trackers.error || entries.error,
  };
}
