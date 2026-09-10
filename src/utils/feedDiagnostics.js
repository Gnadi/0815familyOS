// What a subscribed calendar actually delivered.
//
// A feed that fetches without error can still leave the calendar empty, and
// until now all of those cases looked exactly like success: "Test & subscribe"
// reported no problem, the subscription appeared in the list, and the calendar
// stayed empty with nothing anywhere saying why. The three ways that happens:
//
//   - the URL serves something that is not a calendar at all (a sign-in page,
//     an error page, an HTML view of the calendar) -- the most common mistake
//     is copying the wrong link out of Google's sharing settings;
//   - the calendar is genuinely empty;
//   - every event in it is older than the window myFAOS renders.
//
// Deliberately free of React and Firebase imports so it stays unit-testable.

// How far back a feed is rendered. Anything older is history nobody scrolls
// to, and parsing it on every load costs time. The filter in
// services/calendarFeeds.js and the "nothing newer than…" message both read it
// from here, so they can never drift apart.
export const FEED_PAST_WINDOW_DAYS = 365;

export const FEED_OK = 'ok';
export const FEED_NOT_CALENDAR = 'not-calendar';
export const FEED_NO_EVENTS = 'no-events';
export const FEED_OUT_OF_WINDOW = 'out-of-window';

// Every iCalendar object opens with this, whatever the provider.
export function looksLikeCalendar(ics) {
  return /BEGIN:VCALENDAR/i.test(String(ics || ''));
}

function usableDates(events) {
  return (events || [])
    .map((ev) => ev?.date)
    .filter((d) => d instanceof Date && !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);
}

// Classify one load. `parsed` are the VEVENTs the parser found, `kept` the ones
// that survived the window and dedupe filters (i.e. what the calendar renders).
export function classifyFeed({ ics, parsed = [], kept = [], calendarName = null, now = new Date() } = {}) {
  if (!looksLikeCalendar(ics)) {
    return {
      code: FEED_NOT_CALENDAR,
      parsedCount: 0,
      keptCount: 0,
      upcomingCount: 0,
      calendarName: null,
      nextAt: null,
      latestAt: null,
    };
  }

  const keptDates = usableDates(kept);
  const upcoming = keptDates.filter((d) => d >= now);
  const report = {
    parsedCount: parsed.length,
    keptCount: kept.length,
    upcomingCount: upcoming.length,
    calendarName: calendarName || null,
    nextAt: upcoming[0] || null,
    latestAt: keptDates[keptDates.length - 1] || null,
  };

  if (parsed.length === 0) return { ...report, code: FEED_NO_EVENTS };
  if (kept.length === 0) {
    // Nothing survived the window: name the newest event the feed does have, so
    // "my calendar is full of events" and "…none of them from this decade" can
    // be told apart at a glance.
    const parsedDates = usableDates(parsed);
    return {
      ...report,
      code: FEED_OUT_OF_WINDOW,
      latestAt: parsedDates[parsedDates.length - 1] || null,
    };
  }
  return { ...report, code: FEED_OK };
}

// A report for events served from the cache, where the raw .ics is long gone.
export function cachedFeedReport(events, now = new Date()) {
  const dates = usableDates(events);
  const upcoming = dates.filter((d) => d >= now);
  return {
    code: dates.length ? FEED_OK : FEED_NO_EVENTS,
    parsedCount: (events || []).length,
    keptCount: (events || []).length,
    upcomingCount: upcoming.length,
    calendarName: null,
    nextAt: upcoming[0] || null,
    latestAt: dates[dates.length - 1] || null,
  };
}

// Does this report mean "subscribed, but the family will see nothing"?
export function isSilentlyEmpty(report) {
  return Boolean(report) && report.code !== FEED_OK;
}
