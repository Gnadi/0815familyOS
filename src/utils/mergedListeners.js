// Several Firestore listeners presented as one.
//
// Firestore cannot OR across fields, so a bounded view such as "everything the
// Dashboard needs" is assembled from a few narrow queries (recent events, the
// recurring series, multi-day events reaching into the window, ...). Their
// results overlap, so they are merged by document id.
//
// `sources` are functions `(onData, onError) => unsubscribe`, each delivering
// the full current result of its query as an array of `{ id, ... }` objects.
// `cb` receives the merged array -- but only once every source has delivered
// at least once, so a view never renders a half-loaded window as if it were
// complete. An error from any source is reported once through `onError`; the
// other sources keep running.
export function mergeListeners(sources, cb, { onError, sort } = {}) {
  const latest = sources.map(() => null);
  let failed = false;

  const emit = () => {
    if (latest.some((list) => list === null)) return;
    const byId = new Map();
    latest.forEach((list) => list.forEach((item) => {
      if (!byId.has(item.id)) byId.set(item.id, item);
    }));
    const merged = [...byId.values()];
    if (sort) merged.sort(sort);
    cb(merged);
  };

  const unsubs = sources.map((subscribe, i) => subscribe(
    (list) => {
      latest[i] = list || [];
      emit();
    },
    (err) => {
      // Treat a failed source as empty so the view still settles, and report
      // the failure once rather than once per source.
      if (latest[i] === null) latest[i] = [];
      if (!failed) {
        failed = true;
        onError?.(err);
      }
      emit();
    },
  ));

  return () => unsubs.forEach((unsub) => unsub?.());
}

// Start of the local day `days` days before `date`.
export function startOfDayOffset(date, days = 0) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - days);
  return d;
}

// Local calendar day as YYYY-MM-DD; used to key day-bound shared listeners so
// a new day opens a fresh window instead of reusing yesterday's.
export function localDayKey(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}
