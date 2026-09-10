import { describe, expect, it } from 'vitest';
import {
  cachedFeedReport,
  classifyFeed,
  FEED_NOT_CALENDAR,
  FEED_NO_EVENTS,
  FEED_OK,
  FEED_OUT_OF_WINDOW,
  isSilentlyEmpty,
  looksLikeCalendar,
} from '../../src/utils/feedDiagnostics';
import { feedIssue, feedSummary } from '../../src/utils/feedMessages';
import { parseICS } from '../../src/utils/icsParser';

const at = (y, m, d) => new Date(y, m - 1, d, 9, 0, 0);
const NOW = at(2026, 9, 10);

// Stand-in for the real dictionary: returns the key plus its vars, so the
// assertions below check which message was chosen, not its wording.
const t = (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key);
const tn = (key, count, vars) => `${key}:${JSON.stringify({ ...vars, count })}`;

describe('looksLikeCalendar', () => {
  it('accepts any iCalendar object', () => {
    expect(looksLikeCalendar('BEGIN:VCALENDAR\r\nEND:VCALENDAR')).toBe(true);
    expect(looksLikeCalendar('begin:vcalendar')).toBe(true);
  });

  it('rejects the sign-in page a wrong Google link returns', () => {
    expect(looksLikeCalendar('<!DOCTYPE html><html><title>Sign in</title></html>')).toBe(false);
    expect(looksLikeCalendar('')).toBe(false);
    expect(looksLikeCalendar(null)).toBe(false);
  });
});

describe('classifyFeed', () => {
  it('reports a healthy feed with its counts', () => {
    const kept = [{ date: at(2026, 9, 5) }, { date: at(2026, 9, 20) }, { date: at(2026, 10, 1) }];
    const report = classifyFeed({
      ics: 'BEGIN:VCALENDAR',
      parsed: kept,
      kept,
      calendarName: 'Familie',
      now: NOW,
    });
    expect(report).toMatchObject({
      code: FEED_OK,
      parsedCount: 3,
      keptCount: 3,
      upcomingCount: 2,
      calendarName: 'Familie',
    });
    expect(report.nextAt).toEqual(at(2026, 9, 20));
  });

  it('flags a payload that is not a calendar', () => {
    const report = classifyFeed({ ics: '<html>Sign in</html>', parsed: [], kept: [], now: NOW });
    expect(report.code).toBe(FEED_NOT_CALENDAR);
  });

  it('flags a calendar without any events', () => {
    const ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR';
    expect(classifyFeed({ ics, parsed: [], kept: [], now: NOW }).code).toBe(FEED_NO_EVENTS);
  });

  it('flags a calendar whose events all fall outside the window', () => {
    const parsed = [{ date: at(2019, 1, 1) }, { date: at(2020, 6, 30) }];
    const report = classifyFeed({ ics: 'BEGIN:VCALENDAR', parsed, kept: [], now: NOW });
    expect(report.code).toBe(FEED_OUT_OF_WINDOW);
    expect(report.parsedCount).toBe(2);
    // Names the newest event the feed does hold, so "empty" and "only ancient"
    // can be told apart.
    expect(report.latestAt).toEqual(at(2020, 6, 30));
  });

  it('treats a feed of only past events as healthy, just without anything upcoming', () => {
    const kept = [{ date: at(2026, 8, 1) }];
    const report = classifyFeed({ ics: 'BEGIN:VCALENDAR', parsed: kept, kept, now: NOW });
    expect(report.code).toBe(FEED_OK);
    expect(report.upcomingCount).toBe(0);
    expect(report.nextAt).toBeNull();
  });

  it('ignores events whose date never parsed', () => {
    const kept = [{ date: new Date('nonsense') }, { date: at(2026, 9, 20) }];
    const report = classifyFeed({ ics: 'BEGIN:VCALENDAR', parsed: kept, kept, now: NOW });
    expect(report.upcomingCount).toBe(1);
  });

  it('classifies a real Google feed as healthy', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
      'VERSION:2.0',
      'X-WR-CALNAME:familie@gmail.com',
      'BEGIN:VEVENT',
      'UID:x@google.com',
      'SUMMARY:Zahnarzt',
      'DTSTART;TZID=Europe/Berlin:20260920T100000',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const parsed = parseICS(ics);
    const report = classifyFeed({ ics, parsed: parsed.events, kept: parsed.events, calendarName: parsed.calendarName, now: NOW });
    expect(report.code).toBe(FEED_OK);
    expect(report.calendarName).toBe('familie@gmail.com');
    expect(report.upcomingCount).toBe(1);
  });
});

describe('cachedFeedReport', () => {
  it('describes what the cache holds', () => {
    const report = cachedFeedReport([{ date: at(2026, 9, 1) }, { date: at(2026, 9, 20) }], NOW);
    expect(report).toMatchObject({ code: FEED_OK, keptCount: 2, upcomingCount: 1 });
  });

  it('reports an empty cache as an empty feed', () => {
    expect(cachedFeedReport([], NOW).code).toBe(FEED_NO_EVENTS);
  });
});

describe('isSilentlyEmpty', () => {
  it('is true for every state where the family would see nothing', () => {
    expect(isSilentlyEmpty({ code: FEED_NO_EVENTS })).toBe(true);
    expect(isSilentlyEmpty({ code: FEED_OUT_OF_WINDOW })).toBe(true);
    expect(isSilentlyEmpty({ code: FEED_NOT_CALENDAR })).toBe(true);
    expect(isSilentlyEmpty({ code: FEED_OK })).toBe(false);
    expect(isSilentlyEmpty(null)).toBe(false);
  });
});

describe('feedIssue', () => {
  it('says nothing when the feed is fine', () => {
    expect(feedIssue(t, { report: { code: FEED_OK } })).toBeNull();
    expect(feedIssue(t, {})).toBeNull();
  });

  it('names the wrong-link case as an error', () => {
    const err = Object.assign(new Error('nope'), { code: 'feed/not-calendar' });
    expect(feedIssue(t, { error: err })).toEqual({
      tone: 'error',
      text: 'calImport.issueNotCalendar',
    });
  });

  it('passes an unexpected failure through with its reason', () => {
    const issue = feedIssue(t, { error: new Error('Upstream returned 404') });
    expect(issue.tone).toBe('error');
    expect(issue.text).toContain('Upstream returned 404');
  });

  it('treats serving a stale cache as a warning, not a failure', () => {
    const issue = feedIssue(t, { error: new Error('offline'), stale: true });
    expect(issue).toEqual({ tone: 'warn', text: 'calImport.issueStale' });
  });

  it('warns about a calendar that holds no events', () => {
    expect(feedIssue(t, { report: { code: FEED_NO_EVENTS } })).toEqual({
      tone: 'warn',
      text: 'calImport.issueNoEvents',
    });
  });

  it('says how many events were skipped as too old', () => {
    const issue = feedIssue(t, { report: { code: FEED_OUT_OF_WINDOW, parsedCount: 12 } });
    expect(issue.tone).toBe('warn');
    expect(issue.text).toContain('"count":12');
    expect(issue.text).toContain('"days":365');
  });
});

describe('feedSummary', () => {
  it('reports the counts of a healthy load', () => {
    expect(feedSummary(t, tn, { code: FEED_OK, keptCount: 42, upcomingCount: 8 }))
      .toBe('calImport.loadedEvents:{"upcoming":8,"count":42}');
  });

  it('has nothing to summarise for a feed with a problem', () => {
    expect(feedSummary(t, tn, { code: FEED_NO_EVENTS })).toBeNull();
    expect(feedSummary(t, tn, null)).toBeNull();
  });
});
