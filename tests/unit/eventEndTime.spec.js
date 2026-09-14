import { describe, expect, it } from 'vitest';
import { parseICS } from '../../src/utils/icsParser';
import { expandRecurringEvent } from '../../src/utils/recurrence';
import { eventEnd, formatEventEnd } from '../../src/utils/eventTime';
import { buildICS } from '../../src/utils/ics';

const wrap = (body) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR`;
const event = (lines) =>
  parseICS(wrap(['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n'))).events[0];

describe('parseICS end times', () => {
  it('reads DTEND', () => {
    const ev = event([
      'UID:evt-1',
      'SUMMARY:Elternabend',
      'DTSTART:20260310T180000',
      'DTEND:20260310T193000',
    ]);
    expect(ev.endDate).toEqual(new Date(2026, 2, 10, 19, 30, 0));
  });

  it('reads DTEND written in UTC', () => {
    const ev = event([
      'UID:evt-utc',
      'SUMMARY:Call',
      'DTSTART:20260310T170000Z',
      'DTEND:20260310T180000Z',
    ]);
    expect(ev.endDate.getTime() - ev.date.getTime()).toBe(60 * 60 * 1000);
  });

  it('reads DTEND carried over a TZID parameter', () => {
    const ev = event([
      'UID:evt-tzid',
      'SUMMARY:Turnen',
      'DTSTART;TZID=Europe/Berlin:20260907T150000',
      'DTEND;TZID=Europe/Berlin:20260907T161500',
    ]);
    expect(ev.endDate).toEqual(new Date(2026, 8, 7, 16, 15, 0));
  });

  it('falls back to DURATION when the feed writes no DTEND', () => {
    const ev = event([
      'UID:evt-2',
      'SUMMARY:Schwimmen',
      'DTSTART:20260310T180000',
      'DURATION:PT1H45M',
    ]);
    expect(ev.endDate).toEqual(new Date(2026, 2, 10, 19, 45, 0));
  });

  it('keeps an end that runs past midnight', () => {
    const ev = event([
      'UID:evt-3',
      'SUMMARY:Sommerfest',
      'DTSTART:20260620T200000',
      'DTEND:20260621T010000',
    ]);
    expect(ev.endDate).toEqual(new Date(2026, 5, 21, 1, 0, 0));
    expect(formatEventEnd(ev)).toBe('01:00 +1d');
  });

  it('has no end when the event carries none', () => {
    expect(event(['UID:evt-4', 'SUMMARY:Offen', 'DTSTART:20260310T180000']).endDate).toBeNull();
  });

  it('ignores a DTEND that is not after the start', () => {
    const ev = event([
      'UID:evt-5',
      'SUMMARY:Kaputt',
      'DTSTART:20260310T180000',
      'DTEND:20260310T180000',
    ]);
    expect(ev.endDate).toBeNull();
  });

  it('ignores an unparseable DURATION', () => {
    const ev = event([
      'UID:evt-6',
      'SUMMARY:Kaputt',
      'DTSTART:20260310T180000',
      'DURATION:nonsense',
    ]);
    expect(ev.endDate).toBeNull();
  });

  // An all-day event has no clock time of its own -- we land it on a synthetic
  // 09:00 -- so a synthetic end next to it would read as "09:00 - 09:00".
  it('leaves all-day events without an end', () => {
    const ev = event([
      'UID:evt-7',
      'SUMMARY:Geburtstag',
      'DTSTART;VALUE=DATE:20260714',
      'DTEND;VALUE=DATE:20260715',
    ]);
    expect(ev.endDate).toBeNull();
  });
});

describe('recurring occurrences', () => {
  const master = {
    ...event([
      'UID:series@google.com',
      'SUMMARY:Turnen',
      'DTSTART:20260302T160000',
      'DTEND:20260302T171500',
      'RRULE:FREQ=WEEKLY;INTERVAL=1',
    ]),
    id: 'turnen',
  };

  it('move their end along with their start', () => {
    const out = expandRecurringEvent(master, new Date(2026, 2, 1), new Date(2026, 2, 31));
    expect(out.length).toBeGreaterThan(2);
    for (const occ of out) {
      expect(occ.endDate.getTime() - occ.date.getTime()).toBe(75 * 60 * 1000);
      expect(occ.endDate.getDate()).toBe(occ.date.getDate());
    }
  });

  it('stay end-less when the series has no end', () => {
    const noEnd = { ...master, endDate: null };
    const out = expandRecurringEvent(noEnd, new Date(2026, 2, 1), new Date(2026, 2, 31));
    expect(out.every((occ) => occ.endDate === null)).toBe(true);
  });
});

describe('eventEnd', () => {
  it('accepts an ISO string, as a cached feed event carries', () => {
    const end = eventEnd({ date: new Date(2026, 2, 10, 18, 0), endDate: '2026-03-10T18:30:00' });
    expect(end).toEqual(new Date(2026, 2, 10, 18, 30));
  });

  it('drops an end that no longer follows its start', () => {
    // What a stored import looks like after its start was moved in the form,
    // which has no end field to move with it.
    expect(eventEnd({
      date: new Date(2026, 2, 10, 18, 0),
      endDate: new Date(2026, 2, 10, 17, 0),
    })).toBeNull();
  });

  it('is null without an end, and for an unusable one', () => {
    expect(eventEnd({ date: new Date(2026, 2, 10, 18, 0) })).toBeNull();
    expect(eventEnd({ date: new Date(2026, 2, 10, 18, 0), endDate: 'nonsense' })).toBeNull();
    expect(eventEnd(null)).toBeNull();
  });
});

describe('formatEventEnd', () => {
  it('is null for an event without an end', () => {
    expect(formatEventEnd({ date: new Date(2026, 2, 10, 18, 0) })).toBeNull();
  });

  it('follows the pattern it is given', () => {
    const ev = { date: new Date(2026, 2, 10, 18, 0), endDate: new Date(2026, 2, 10, 19, 30) };
    expect(formatEventEnd(ev)).toBe('19:30');
    expect(formatEventEnd(ev, 'p')).toBe('7:30 PM');
  });
});

describe('buildICS', () => {
  it('exports the event\'s own end when it has one', () => {
    const ics = buildICS([{
      id: 'e1',
      title: 'Elternabend',
      date: new Date(2026, 2, 10, 18, 0),
      endDate: new Date(2026, 2, 10, 19, 30),
    }]);
    expect(ics).toContain('DTSTART:20260310T180000');
    expect(ics).toContain('DTEND:20260310T193000');
  });

  it('still assumes an hour for an event without one', () => {
    const ics = buildICS([{ id: 'e2', title: 'Offen', date: new Date(2026, 2, 10, 18, 0) }]);
    expect(ics).toContain('DTEND:20260310T190000');
  });
});
