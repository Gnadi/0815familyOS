// Turn one subscription's load result into a sentence a parent can act on.
//
// Every caller of loadFeed()/loadAllFeeds() gets the same wording out of this:
// the subscribe test, the manual sync, and the banner on the calendar. `t` is
// passed in rather than imported so the helper stays outside React.

import {
  FEED_NOT_CALENDAR,
  FEED_NO_EVENTS,
  FEED_OK,
  FEED_OUT_OF_WINDOW,
  FEED_PAST_WINDOW_DAYS,
} from './feedDiagnostics';

// Returns { tone: 'error' | 'warn', text } — or null when the feed is fine.
export function feedIssue(t, { report, error, stale } = {}) {
  if (error) {
    if (error.code === 'feed/not-calendar') {
      return { tone: 'error', text: t('calImport.issueNotCalendar') };
    }
    // A stale cache is still a calendar: say the events may be out of date
    // rather than implying there are none.
    if (stale) return { tone: 'warn', text: t('calImport.issueStale') };
    return {
      tone: 'error',
      text: t('calImport.issueFetchFailed', { reason: error.message || '' }),
    };
  }
  if (!report || report.code === FEED_OK) return null;
  if (report.code === FEED_NOT_CALENDAR) {
    return { tone: 'error', text: t('calImport.issueNotCalendar') };
  }
  if (report.code === FEED_NO_EVENTS) {
    return { tone: 'warn', text: t('calImport.issueNoEvents') };
  }
  if (report.code === FEED_OUT_OF_WINDOW) {
    return {
      tone: 'warn',
      text: t('calImport.issueOutOfWindow', {
        count: report.parsedCount,
        days: FEED_PAST_WINDOW_DAYS,
      }),
    };
  }
  return null;
}

// The positive counterpart: what a successful load actually brought in.
export function feedSummary(t, tn, report) {
  if (!report || report.code !== FEED_OK) return null;
  return tn('calImport.loadedEvents', report.keptCount, { upcoming: report.upcomingCount });
}
