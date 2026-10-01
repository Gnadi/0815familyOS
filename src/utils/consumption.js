// Purchase rhythms: when will the family need a product again?
//
// The input is the purchase log kept per product in `shoppingProducts` (see
// docs/smart-shopping.md). Units are deliberately not modelled, matching
// utils/ingredients.js: the time between two purchases already says how fast
// this family gets through a product, whatever the pack size.
//
// Pure, on plain Dates, so the whole thing is unit-tested without Firestore.

const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

// Ticks this close together are one shopping trip. Two "Milch" tiles checked
// off in the same shop, or a mis-tap ticked twice, must not read as "bought
// milk twice within a minute" and drag the rhythm down to nothing.
export const TRIP_GAP_MS = 12 * HOUR;

// Two intervals is the least that can disagree with each other; one interval
// is a coincidence, not a rhythm.
export const MIN_TRIPS = 3;

// Only the recent past counts, so a rhythm follows a family that changes —
// a new baby, a child who stopped drinking milk.
const MAX_INTERVALS = 7;

// Median absolute deviation relative to the median. Above this the intervals
// are too scattered to predict from (birthday candles, a one-off recipe). The
// median-based spread is what lets a single holiday gap through: 3, 3, 3, 17
// days still reads as "every three days".
const MAX_RELATIVE_SPREAD = 0.6;

const MIN_INTERVAL_DAYS = 1;

// "We still have it" pushes the due date out by half a rhythm, but never by
// less than this — otherwise a daily product would come straight back.
const MIN_SNOOZE_DAYS = 2;

// An ignored suggestion goes quiet after its due date has passed by a whole
// rhythm (at least a week): the family has probably stopped buying it, and a
// suggestion that never leaves teaches people to ignore all of them.
const MIN_DORMANT_DAYS = 7;

function toDate(value) {
  if (!value) return null;
  const d = value?.toDate ? value.toDate() : value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Purchases that say something about how fast the family uses a product.
// A purchase marked `planned` was made only because a planned meal needed it
// (see docs/smart-shopping.md): the family does not eat the same thing every
// week, so the rhythm of the meal plan is not a rhythm of the product.
export function ownPurchases(purchases) {
  return (purchases || []).filter((p) => p && !p.planned);
}

// Purchase entries ({ at }) → one Date per trip, oldest first.
export function tripsOf(purchases) {
  const times = (purchases || [])
    .map((p) => toDate(p?.at ?? p))
    .filter(Boolean)
    .map((d) => d.getTime())
    .sort((a, b) => a - b);

  const trips = [];
  for (const time of times) {
    const last = trips[trips.length - 1];
    if (last !== undefined && time - last < TRIP_GAP_MS) continue;
    trips.push(time);
  }
  return trips.map((time) => new Date(time));
}

// Statuses:
//   learning   — fewer than MIN_TRIPS trips, nothing to say yet
//   irregular  — bought, but not on any rhythm
//   predicted  — dueAt is meaningful
//   dormant    — was predicted, but ignored for so long it should stop asking
export function predictProduct(product, now = new Date()) {
  const trips = tripsOf(ownPurchases(product?.purchases));
  const lastBought = trips.length ? trips[trips.length - 1] : null;
  const base = { trips: trips.length, lastBought, intervalDays: null, dueAt: null };
  if (trips.length < MIN_TRIPS) return { ...base, status: 'learning' };

  const intervals = [];
  for (let i = Math.max(1, trips.length - MAX_INTERVALS); i < trips.length; i += 1) {
    intervals.push((trips[i] - trips[i - 1]) / DAY);
  }
  const typical = median(intervals);
  const spread = median(intervals.map((x) => Math.abs(x - typical))) / typical;
  if (spread > MAX_RELATIVE_SPREAD) return { ...base, status: 'irregular' };

  const intervalDays = Math.max(MIN_INTERVAL_DAYS, typical);
  let due = lastBought.getTime() + intervalDays * DAY;

  const stillHave = toDate(product?.stillHaveAt);
  if (stillHave && stillHave > lastBought) {
    const snooze = Math.max(MIN_SNOOZE_DAYS, intervalDays / 2) * DAY;
    due = Math.max(due, stillHave.getTime() + snooze);
  }

  const dormantFrom = due + Math.max(MIN_DORMANT_DAYS, intervalDays) * DAY;
  return {
    ...base,
    status: now.getTime() > dormantFrom ? 'dormant' : 'predicted',
    intervalDays,
    dueAt: new Date(due),
  };
}

// Whole days between two moments, by calendar day rather than 24h blocks, so
// "bought yesterday evening" reads as 1 day ago the next morning.
export function daysBetween(earlier, later) {
  const a = new Date(earlier);
  const b = new Date(later);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / DAY);
}
