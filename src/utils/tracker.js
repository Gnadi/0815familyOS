// Pure helpers behind the flexible per-child tracker (see src/pages/TrackerPage).
//
// A tracker is deliberately just a *counter of moments*: every entry records
// when something happened for one child, plus an optional number and note.
// The three questions the feature was built for all fall out of that:
//
//   "When did Anna last get her medicine?"  -> last entry + cooldown
//   "When did Steffi last throw up?"        -> last entry
//   "Has Lukas had his vitamin D today?"    -> today's count vs. dailyGoal
//
// Everything here is date math on plain JS Dates so it can be unit-tested
// without React or Firestore (tests/unit/tracker.spec.js).

const HOUR_MS = 60 * 60 * 1000;

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isSameDay(a, b) {
  if (!a || !b) return false;
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

// Entries belonging to one tracker card. `kidId` matters because a tracker can
// be shared by several children (one "Vitamin D" tracker, one entry per kid).
export function entriesForTracker(entries, trackerId, kidId) {
  return entries.filter(
    (e) => e.trackerId === trackerId && (!kidId || e.kidId === kidId),
  );
}

// Newest first. Entries without a timestamp sort last rather than crashing the
// comparator, so a half-written document can never blank the whole list.
export function sortEntriesDesc(entries) {
  return [...entries].sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));
}

export function countOnDay(entries, day) {
  return entries.filter((e) => isSameDay(e.at, day)).length;
}

// Sum of the numeric values logged on `day` (null when nothing numeric was
// logged), so a dosage tracker can show "3 ml today" next to the count.
export function sumOnDay(entries, day) {
  const values = entries
    .filter((e) => isSameDay(e.at, day) && typeof e.value === 'number' && !Number.isNaN(e.value))
    .map((e) => e.value);
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
}

// Coarse "how long ago" split, as a unit + count the caller turns into a
// pluralized string via tn(). Deliberately not date-fns' formatDistance: for a
// medicine log "3 hours ago" must not round up to "about 4 hours".
export function relativeSince(from, now = new Date()) {
  if (!from) return null;
  const diff = now.getTime() - from.getTime();
  if (diff < 0) return { unit: 'soon', count: 0 };
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return { unit: 'now', count: 0 };
  if (minutes < 60) return { unit: 'minute', count: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: 'hour', count: hours };
  return { unit: 'day', count: Math.floor(hours / 24) };
}

// When the next dose may be given. Null when the tracker has no cooldown or
// nothing has been logged yet.
export function cooldownUntil(lastAt, minIntervalHours) {
  if (!lastAt || !minIntervalHours || minIntervalHours <= 0) return null;
  return new Date(lastAt.getTime() + minIntervalHours * HOUR_MS);
}

// Everything a tracker card renders, derived in one place so the card stays
// presentational and the logic stays testable.
export function trackerStatus(tracker, entries, kidId, now = new Date()) {
  const own = sortEntriesDesc(entriesForTracker(entries, tracker.id, kidId));
  const last = own[0] ?? null;
  const lastAt = last?.at ?? null;
  const todayCount = countOnDay(own, now);
  const goal = tracker.dailyGoal || 0;
  const until = cooldownUntil(lastAt, tracker.minIntervalHours);

  return {
    entries: own,
    last,
    lastAt,
    since: relativeSince(lastAt, now),
    // Whether the last entry falls on the day being looked at. A goal card
    // showing "last at 08:15" must not imply *this* morning when the entry is
    // from yesterday — that is the exact question the card answers.
    lastWasToday: isSameDay(lastAt, now),
    todayCount,
    todaySum: sumOnDay(own, now),
    hasGoal: goal > 0,
    goal,
    goalMet: goal > 0 && todayCount >= goal,
    cooldownUntil: until,
    // Strictly greater-than: at exactly the interval the next dose is due, not
    // still blocked.
    cooldownActive: Boolean(until && until.getTime() > now.getTime()),
  };
}

// Groups a sorted-desc entry list into day buckets for the history sheet.
export function groupEntriesByDay(entries) {
  const groups = [];
  for (const entry of sortEntriesDesc(entries)) {
    const day = entry.at ? startOfDay(entry.at) : null;
    const key = day ? day.getTime() : 'unknown';
    const head = groups[groups.length - 1];
    if (head && head.key === key) head.entries.push(entry);
    else groups.push({ key, day, entries: [entry] });
  }
  return groups;
}

// Flattens the family's trackers into one (child, tracker, status) list for
// the Dashboard, which has no child tabs and has to speak for everyone at once.
//
// The ordering is what makes the widget useful in a glance: things still owed
// today come first, then anything on a cooldown, then whatever was touched
// most recently. A tracker shared by siblings contributes one row per child,
// because "Lukas still needs his vitamin D" is a different fact from "Anna
// already had hers".
export function activeTrackerRows(trackers, entries, kids, now = new Date()) {
  const rows = [];
  for (const kid of kids) {
    for (const tracker of trackers) {
      if (!tracker.kidIds.includes(kid.id)) continue;
      rows.push({ key: `${tracker.id}:${kid.id}`, kid, tracker, status: trackerStatus(tracker, entries, kid.id, now) });
    }
  }

  const rank = ({ status }) => {
    if (status.hasGoal && !status.goalMet) return 0;
    if (status.cooldownActive) return 1;
    return 2;
  };

  return rows.sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    // Within a rank, most recently logged first; never-logged trackers sort
    // last rather than jumping the queue with a timestamp of 0.
    return (b.status.lastAt?.getTime() ?? -Infinity) - (a.status.lastAt?.getTime() ?? -Infinity);
  });
}
