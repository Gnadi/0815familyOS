// Full-text search across the family calendar.
//
// The calendar renders three kinds of event and search has to cover all of
// them: the family's own Firestore events, events imported once from an .ics
// file (stored, `source: 'import'`), and the events computed on the fly from
// subscribed calendars (`source: 'subscription'`, never stored). `useEvents`
// already merges those into one list, so searching works on the merged list
// and stays oblivious to where an event came from -- with one addition: a
// subscribed event also matches on the name of the calendar it came from, so
// "school" finds everything the school feed brings in.
//
// Deliberately free of React and Firebase imports so it stays unit-testable.

import { startOfDay } from 'date-fns';
import { expandEventsInRange, isValidRecurrence } from './recurrence';

const DAY_MS = 24 * 60 * 60 * 1000;

// How far a recurring series is expanded while searching. One-off events are
// never windowed (see below), so this only bounds series expansion.
export const SEARCH_PAST_DAYS = 365;
export const SEARCH_FUTURE_DAYS = 365;

// How many results are handed to the UI, and how many occurrences a single
// recurring series may contribute. Without the per-series cap a daily event
// matching the query fills the entire list with itself.
export const SEARCH_LIMIT = 50;
export const MAX_PER_SERIES = 3;

export const EMPTY_SEARCH_RESULT = Object.freeze({
  upcoming: Object.freeze([]),
  past: Object.freeze([]),
  total: 0,
  truncated: false,
});

// Lowercase and strip diacritics, so "zahnarzt" finds "Zahnärztin".
export function foldText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss');
}

const UMLAUT_EXPANSIONS = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

// The other half of German folding: "München" is also spelled "Muenchen".
// Stripping the diaeresis alone gives "munchen", which that spelling never
// matches, so the haystack carries both readings and the query only needs the
// stripped one.
function expandUmlauts(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => UMLAUT_EXPANSIONS[c]);
}

// Split a query into the terms that all have to match ("zahnarzt lena").
export function searchTokens(query) {
  const folded = foldText(query).trim();
  if (!folded) return [];
  return [...new Set(folded.split(/\s+/).filter(Boolean))];
}

// The fields a user can reasonably expect to search on. `subscriptionLabel` is
// what makes a synced event findable by its calendar, `location` finds the
// afternoon at the airport by the airport; category and kid names are ids on
// the event, so they need the caller's lookups to become text.
function searchableFields(event, context) {
  const fields = [
    event.title,
    event.description,
    event.responsibleParent,
    event.subscriptionLabel,
    event.location,
  ];
  if (context?.categoryLabel) fields.push(context.categoryLabel(event.category));
  if (context?.kidName) {
    for (const kidId of event.kids || []) fields.push(context.kidName(kidId));
  }
  return fields;
}

export function eventSearchText(event, context) {
  if (!event) return '';
  const parts = [];
  for (const field of searchableFields(event, context)) {
    const value = String(field ?? '').trim();
    if (!value) continue;
    const folded = foldText(value);
    parts.push(folded);
    const expanded = foldText(expandUmlauts(value));
    if (expanded !== folded) parts.push(expanded);
  }
  return parts.join(' ');
}

// Building the haystack costs more than testing it, and the calendar re-runs
// the search on every keystroke over the same event objects. Feed events and
// Firestore snapshots both keep their identity between renders, so caching on
// the object itself skips the work for all but the first keystroke.
const textCache = new WeakMap();

function cachedSearchText(event, context) {
  const cached = textCache.get(event);
  if (cached && cached.context === context) return cached.text;
  const text = eventSearchText(event, context);
  textCache.set(event, { context, text });
  return text;
}

export function eventMatches(event, tokens, context) {
  if (!event || !tokens?.length) return false;
  const text = cachedSearchText(event, context);
  return tokens.every((token) => text.includes(token));
}

function hasDate(event) {
  return event?.date instanceof Date && !Number.isNaN(event.date.getTime());
}

// Keep a matching series from flooding the results: show the occurrences
// nearest to now -- the next ones, topped up with the most recent past ones
// when the series is over or has barely started.
function limitPerSeries(occurrences, now, maxPerSeries) {
  if (!(maxPerSeries > 0)) return occurrences;
  const bySeries = new Map();
  for (const ev of occurrences) {
    const key = ev.masterId || ev.id;
    const bucket = bySeries.get(key);
    if (bucket) bucket.push(ev);
    else bySeries.set(key, [ev]);
  }

  const out = [];
  for (const bucket of bySeries.values()) {
    if (bucket.length <= maxPerSeries) {
      out.push(...bucket);
      continue;
    }
    bucket.sort((a, b) => a.date - b.date);
    const firstUpcoming = bucket.findIndex((ev) => ev.date >= now);
    const start = firstUpcoming === -1
      ? bucket.length - maxPerSeries
      : Math.min(firstUpcoming, bucket.length - maxPerSeries);
    out.push(...bucket.slice(start, start + maxPerSeries));
  }
  return out;
}

// Search `events` (own + imported + subscribed) for `query`.
//
// Returns { upcoming, past, total, truncated }: upcoming ascending from today,
// past descending, because "what's coming up" is what someone searching a
// calendar is nearly always after.
export function searchEvents(events, query, options = {}) {
  const {
    context = null,
    now = new Date(),
    limit = SEARCH_LIMIT,
    maxPerSeries = MAX_PER_SERIES,
    pastDays = SEARCH_PAST_DAYS,
    futureDays = SEARCH_FUTURE_DAYS,
  } = options;

  const tokens = searchTokens(query);
  if (!tokens.length) return EMPTY_SEARCH_RESULT;

  // Every occurrence of a series carries the same text as its master, so the
  // match runs before the expansion: one string test per event instead of one
  // per occurrence.
  const matched = (events || []).filter((ev) => hasDate(ev) && eventMatches(ev, tokens, context));
  if (!matched.length) return EMPTY_SEARCH_RESULT;

  const series = [];
  const occurrences = [];
  for (const ev of matched) {
    // A one-off event is already a concrete occurrence and is kept whatever its
    // date: a trip booked three years out has to be findable, even though it
    // sits far outside the window a series is expanded over.
    if (isValidRecurrence(ev.recurrence)) series.push(ev);
    else occurrences.push(ev);
  }
  if (series.length) {
    const from = new Date(now.getTime() - pastDays * DAY_MS);
    const to = new Date(now.getTime() + futureDays * DAY_MS);
    occurrences.push(...limitPerSeries(expandEventsInRange(series, from, to), now, maxPerSeries));
  }

  // A meeting earlier today is still "today's schedule", not history.
  const todayStart = startOfDay(now);
  const upcoming = [];
  const past = [];
  for (const ev of occurrences) {
    if (ev.date >= todayStart) upcoming.push(ev);
    else past.push(ev);
  }
  upcoming.sort((a, b) => a.date - b.date);
  past.sort((a, b) => b.date - a.date);

  const total = upcoming.length + past.length;
  const shownUpcoming = upcoming.slice(0, Math.max(0, limit));
  const shownPast = past.slice(0, Math.max(0, limit - shownUpcoming.length));
  return {
    upcoming: shownUpcoming,
    past: shownPast,
    total,
    truncated: shownUpcoming.length + shownPast.length < total,
  };
}
