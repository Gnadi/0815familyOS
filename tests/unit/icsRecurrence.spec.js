import { describe, expect, it } from 'vitest';
import { parseICS } from '../../src/utils/icsParser';
import { expandRecurringEvent, occurrenceKey } from '../../src/utils/recurrence';

// Google writes these three rule forms constantly, and all three used to be
// dropped on the floor: a BYDAY series showed only the master's weekday, a
// COUNT series never ended, and cancelled occurrences kept coming back.
const wrap = (body) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Google Inc//Google Calendar 70.9054//EN', body, 'END:VCALENDAR'].join('\r\n');

const event = (lines) => parseICS(wrap(['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n'))).events[0];

const days = (occurrences) =>
  occurrences.map((o) => `${['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][o.date.getDay()]} ${o.date.getDate()}.${o.date.getMonth() + 1}.`);

describe('occurrenceKey', () => {
  it('is the local wall-clock form an EXDATE carries', () => {
    expect(occurrenceKey(new Date(2026, 8, 15, 16, 0, 0))).toBe('20260915T160000');
  });

  it('is empty for a missing or invalid date', () => {
    expect(occurrenceKey(null)).toBe('');
    expect(occurrenceKey(new Date('nonsense'))).toBe('');
  });
});

describe('RRULE BYDAY', () => {
  const master = () => ({
    ...event([
      'UID:multi@google.com',
      'SUMMARY:Hort Abholung',
      'DTSTART;TZID=Europe/Berlin:20260907T150000',
      'RRULE:FREQ=WEEKLY;WKST=SU;BYDAY=MO,WE,FR',
    ]),
    id: 'hort',
  });

  it('parses the named weekdays', () => {
    expect(master().recurrence).toMatchObject({ freq: 'weekly', interval: 1, byDay: ['MO', 'WE', 'FR'] });
  });

  it('expands every named weekday, not just the master\'s own', () => {
    const out = expandRecurringEvent(master(), new Date(2026, 8, 7), new Date(2026, 8, 20, 23, 59));
    expect(days(out)).toEqual([
      'Mo 7.9.', 'Mi 9.9.', 'Fr 11.9.',
      'Mo 14.9.', 'Mi 16.9.', 'Fr 18.9.',
    ]);
  });

  it('keeps the series time of day', () => {
    const out = expandRecurringEvent(master(), new Date(2026, 8, 7), new Date(2026, 8, 13));
    expect(out.every((o) => o.date.getHours() === 15 && o.date.getMinutes() === 0)).toBe(true);
  });

  it('does not emit named days that fall before the series starts', () => {
    // Series starts on a Wednesday; the Monday of that same week is not an
    // occurrence.
    const wed = { ...master(), date: new Date(2026, 8, 9, 15, 0) };
    const out = expandRecurringEvent(wed, new Date(2026, 8, 1), new Date(2026, 8, 13));
    expect(days(out)).toEqual(['Mi 9.9.', 'Fr 11.9.']);
  });

  it('honours the interval between weeks', () => {
    const biweekly = event([
      'UID:b@google.com',
      'SUMMARY:Musikschule',
      'DTSTART:20260907T150000',
      'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH',
    ]);
    const out = expandRecurringEvent({ ...biweekly, id: 'm' }, new Date(2026, 8, 7), new Date(2026, 9, 5, 23, 59));
    expect(days(out)).toEqual(['Mo 7.9.', 'Do 10.9.', 'Mo 21.9.', 'Do 24.9.', 'Mo 5.10.']);
  });

  it('stops at UNTIL', () => {
    const limited = event([
      'UID:u@google.com',
      'SUMMARY:Kurs',
      'DTSTART:20260907T150000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20260916T215959Z',
    ]);
    const out = expandRecurringEvent({ ...limited, id: 'k' }, new Date(2026, 8, 1), new Date(2026, 9, 30));
    expect(days(out)).toEqual(['Mo 7.9.', 'Mi 9.9.', 'Mo 14.9.', 'Mi 16.9.']);
  });

  it('finds a long-running series without walking there week by week', () => {
    const old = event([
      'UID:old@google.com',
      'SUMMARY:Schwimmen',
      'DTSTART:20120903T150000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO,FR',
    ]);
    const out = expandRecurringEvent({ ...old, id: 's' }, new Date(2026, 8, 7), new Date(2026, 8, 13, 23, 59));
    expect(days(out)).toEqual(['Mo 7.9.', 'Fr 11.9.']);
  });

  it('gives each occurrence a stable id whichever window is expanded', () => {
    const wide = expandRecurringEvent(master(), new Date(2026, 8, 1), new Date(2026, 8, 30));
    const narrow = expandRecurringEvent(master(), new Date(2026, 8, 14), new Date(2026, 8, 20));
    const overlap = wide.filter((o) => o.date >= new Date(2026, 8, 14) && o.date <= new Date(2026, 8, 20));
    expect(narrow.map((o) => o.id)).toEqual(overlap.map((o) => o.id));
  });

  it('ignores ordinal BYDAY forms that belong to monthly rules', () => {
    const monthly = event([
      'UID:m2@google.com',
      'SUMMARY:Elternbeirat',
      'DTSTART:20260908T190000',
      'RRULE:FREQ=MONTHLY;BYDAY=2TU',
    ]);
    expect(monthly.recurrence.byDay).toBeNull();
  });
});

describe('RRULE COUNT', () => {
  const course = () => ({
    ...event([
      'UID:counted@google.com',
      'SUMMARY:Kurs',
      'DTSTART:20260907T180000',
      'RRULE:FREQ=WEEKLY;COUNT=6',
    ]),
    id: 'kurs',
  });

  it('parses the count', () => {
    expect(course().recurrence.count).toBe(6);
  });

  it('ends the series after exactly that many occurrences', () => {
    const out = expandRecurringEvent(course(), new Date(2026, 8, 1), new Date(2027, 0, 31));
    expect(out).toHaveLength(6);
    expect(days(out).at(-1)).toBe('Mo 12.10.');
  });

  it('counts from the series start, not from the window', () => {
    // The window opens after occurrence four; only two are left.
    const out = expandRecurringEvent(course(), new Date(2026, 8, 28), new Date(2027, 0, 31));
    expect(days(out)).toEqual(['Mo 28.9.', 'Mo 5.10.', 'Mo 12.10.']);
  });

  it('applies to a BYDAY series too', () => {
    const counted = event([
      'UID:c2@google.com',
      'SUMMARY:Training',
      'DTSTART:20260907T170000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=5',
    ]);
    const out = expandRecurringEvent({ ...counted, id: 't' }, new Date(2026, 8, 1), new Date(2026, 11, 31));
    expect(days(out)).toEqual(['Mo 7.9.', 'Mi 9.9.', 'Mo 14.9.', 'Mi 16.9.', 'Mo 21.9.']);
  });
});

describe('EXDATE', () => {
  const series = () => ({
    ...event([
      'UID:exd@google.com',
      'SUMMARY:Turnen',
      'DTSTART;TZID=Europe/Berlin:20260908T160000',
      'RRULE:FREQ=WEEKLY',
      'EXDATE;TZID=Europe/Berlin:20260915T160000',
      'EXDATE;TZID=Europe/Berlin:20260922T160000',
    ]),
    id: 'turnen',
  });

  it('collects every EXDATE line instead of letting them overwrite each other', () => {
    expect(series().recurrence.exdates).toEqual(['20260915T160000', '20260922T160000']);
  });

  it('reads a comma-separated EXDATE list', () => {
    const ev = event([
      'UID:exd2@google.com',
      'SUMMARY:Turnen',
      'DTSTART:20260908T160000',
      'RRULE:FREQ=WEEKLY',
      'EXDATE:20260915T160000,20260922T160000',
    ]);
    expect(ev.recurrence.exdates).toEqual(['20260915T160000', '20260922T160000']);
  });

  it('leaves cancelled occurrences out of the calendar', () => {
    const out = expandRecurringEvent(series(), new Date(2026, 8, 1), new Date(2026, 8, 30));
    expect(days(out)).toEqual(['Di 8.9.', 'Di 29.9.']);
  });

  it('does not shift the ids of the occurrences around it', () => {
    const withGaps = expandRecurringEvent(series(), new Date(2026, 8, 1), new Date(2026, 8, 30));
    const plain = expandRecurringEvent(
      { ...series(), recurrence: { ...series().recurrence, exdates: [] } },
      new Date(2026, 8, 1),
      new Date(2026, 8, 30),
    );
    const byDate = new Map(plain.map((o) => [occurrenceKey(o.date), o.id]));
    for (const occ of withGaps) expect(occ.id).toBe(byDate.get(occurrenceKey(occ.date)));
  });

  it('cancels a day of a BYDAY series without touching the rest of the week', () => {
    const ev = event([
      'UID:exd3@google.com',
      'SUMMARY:Hort',
      'DTSTART:20260907T150000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR',
      'EXDATE:20260909T150000',
    ]);
    const out = expandRecurringEvent({ ...ev, id: 'h' }, new Date(2026, 8, 7), new Date(2026, 8, 13));
    expect(days(out)).toEqual(['Mo 7.9.', 'Fr 11.9.']);
  });

  it('is ignored without a rule that would generate the occurrence', () => {
    const single = event([
      'UID:single@google.com',
      'SUMMARY:Einzeltermin',
      'DTSTART:20260908T160000',
      'EXDATE:20260915T160000',
    ]);
    expect(single.recurrence).toBeNull();
  });
});

describe('a rule without the new fields keeps behaving exactly as before', () => {
  it('expands a plain weekly series', () => {
    const ev = event(['UID:p@google.com', 'SUMMARY:Yoga', 'DTSTART:20260907T190000', 'RRULE:FREQ=WEEKLY']);
    const out = expandRecurringEvent({ ...ev, id: 'y' }, new Date(2026, 8, 7), new Date(2026, 8, 28, 23, 59));
    expect(days(out)).toEqual(['Mo 7.9.', 'Mo 14.9.', 'Mo 21.9.', 'Mo 28.9.']);
    expect(out[0].id).toBe('y');
    expect(out[0].isRecurringInstance).toBe(false);
    expect(out[1].id).toBe('y__r1');
  });
});
