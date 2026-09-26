import { describe, expect, it } from 'vitest';
import { parseICS } from '../../src/utils/icsParser';
import {
  eventDayCount,
  eventDayIndex,
  eventDays,
  eventEnd,
  isAllDay,
} from '../../src/utils/eventTime';
import { dayKey, groupEventsByDay } from '../../src/utils/date';
import { expandEventsInRange, expandRecurringEvent, occurrenceKey } from '../../src/utils/recurrence';
import { minuteAtOffset, splitAllDay, HOUR_HEIGHT } from '../../src/utils/dayTimeline';
import { findConflicts } from '../../src/utils/eventConflicts';
import { buildICS } from '../../src/utils/ics';

const wrap = (body) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR`;
const parse = (lines) =>
  parseICS(wrap(['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n'))).events[0];
const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe('all-day events from .ics', () => {
  it('flags a DATE-form event as all-day, without an end for one day', () => {
    const ev = parse([
      'UID:bday',
      'SUMMARY:Geburtstag',
      'DTSTART;VALUE=DATE:20260714',
      'DTEND;VALUE=DATE:20260715',
    ]);
    expect(ev.allDay).toBe(true);
    expect(ev.endDate).toBeNull();
    expect(eventDayCount(ev)).toBe(1);
  });

  it('keeps the exclusive end day of a multi-day holiday', () => {
    const ev = parse([
      'UID:ferien',
      'SUMMARY:Herbstferien',
      'DTSTART;VALUE=DATE:20261026',
      'DTEND;VALUE=DATE:20261031',
    ]);
    expect(ev.allDay).toBe(true);
    expect(ev.endDate).toEqual(at(2026, 10, 31));
    expect(eventDays(ev)).toEqual({ first: at(2026, 10, 26), last: at(2026, 10, 30) });
    expect(eventDayCount(ev)).toBe(5);
  });

  it('reads a multi-day all-day DURATION', () => {
    const ev = parse([
      'UID:camp',
      'SUMMARY:Camp',
      'DTSTART;VALUE=DATE:20260801',
      'DURATION:P3D',
    ]);
    expect(eventDayCount(ev)).toBe(3);
  });

  it('never exposes an end time for an all-day event', () => {
    const ev = { date: at(2026, 10, 26), endDate: at(2026, 10, 31), allDay: true };
    expect(isAllDay(ev)).toBe(true);
    expect(eventEnd(ev)).toBeNull();
  });

  it('does not flag timed events', () => {
    const ev = parse(['UID:t', 'SUMMARY:Arzt', 'DTSTART:20260310T100000']);
    expect(ev.allDay).toBe(false);
  });
});

describe('eventDays for timed events', () => {
  it('keeps an event that ends at midnight on its own day', () => {
    const ev = { date: at(2026, 3, 10, 20), endDate: at(2026, 3, 11) };
    expect(eventDayCount(ev)).toBe(1);
  });

  it('reaches into the next day when it ends after midnight', () => {
    const ev = { date: at(2026, 3, 10, 22), endDate: at(2026, 3, 11, 6) };
    expect(eventDayCount(ev)).toBe(2);
    expect(eventDayIndex(ev, at(2026, 3, 11))).toBe(2);
    expect(eventDayIndex(ev, at(2026, 3, 12))).toBe(0);
  });
});

describe('groupEventsByDay with multi-day events', () => {
  it('puts a holiday on every day it covers, all-day first', () => {
    const holiday = { id: 'h', date: at(2026, 10, 26, 9), endDate: at(2026, 10, 29), allDay: true };
    const dentist = { id: 'd', date: at(2026, 10, 27, 8) };
    const byDay = groupEventsByDay([dentist, holiday]);
    expect(byDay.get(dayKey(at(2026, 10, 26))).map((e) => e.id)).toEqual(['h']);
    expect(byDay.get(dayKey(at(2026, 10, 27))).map((e) => e.id)).toEqual(['h', 'd']);
    expect(byDay.get(dayKey(at(2026, 10, 28))).map((e) => e.id)).toEqual(['h']);
    expect(byDay.get(dayKey(at(2026, 10, 29)))).toBeUndefined();
  });
});

describe('expandEventsInRange', () => {
  it('keeps an event that started before the window but runs into it', () => {
    const trip = { id: 't', date: at(2026, 9, 28, 9), endDate: at(2026, 10, 4), allDay: true };
    const out = expandEventsInRange([trip], at(2026, 10, 1), at(2026, 10, 31, 23, 59));
    expect(out.map((e) => e.id)).toEqual(['t']);
  });

  it('still drops an event that ended before the window', () => {
    const old = { id: 'o', date: at(2026, 9, 1, 9), endDate: at(2026, 9, 3) , allDay: true };
    expect(expandEventsInRange([old], at(2026, 10, 1), at(2026, 10, 31))).toEqual([]);
  });
});

describe('single occurrences of a series', () => {
  const master = {
    id: 'turnen',
    title: 'Turnen',
    date: at(2026, 3, 2, 16),
    recurrence: { freq: 'weekly', interval: 1 },
  };

  it('leaves out an occurrence listed in exdates and keeps the ids around it', () => {
    const cancelled = { ...master, recurrence: { ...master.recurrence, exdates: [occurrenceKey(at(2026, 3, 9, 16))] } };
    const out = expandRecurringEvent(cancelled, at(2026, 3, 1), at(2026, 3, 22, 23));
    expect(out.map((o) => o.date.getDate())).toEqual([2, 16]);
    expect(out.map((o) => o.id)).toEqual(['turnen', 'turnen__r2']);
  });

  it('marks every occurrence with its series, the first one included', () => {
    const out = expandRecurringEvent(master, at(2026, 3, 1), at(2026, 3, 10));
    expect(out.every((o) => o.masterId === 'turnen')).toBe(true);
  });
});

describe('day timeline helpers', () => {
  it('moves all-day events and fully covered days into the strip', () => {
    const day = at(2026, 10, 27);
    const holiday = { id: 'h', date: at(2026, 10, 26, 9), endDate: at(2026, 10, 29), allDay: true };
    const shift = { id: 's', date: at(2026, 10, 26, 20), endDate: at(2026, 10, 28, 8) };
    const lunch = { id: 'l', date: at(2026, 10, 27, 12), endDate: at(2026, 10, 27, 13) };
    const tail = { id: 't', date: at(2026, 10, 26, 22), endDate: at(2026, 10, 27, 7) };
    const { allDay, timed } = splitAllDay([holiday, shift, lunch, tail], day);
    expect(allDay.map((e) => e.id)).toEqual(['h', 's']);
    expect(timed.map((e) => e.id)).toEqual(['l', 't']);
  });

  it('turns a tap into the half hour it points at', () => {
    expect(minuteAtOffset(0, 8)).toBe(8 * 60);
    expect(minuteAtOffset(HOUR_HEIGHT * 1.6, 8)).toBe(9 * 60 + 30);
    expect(minuteAtOffset(HOUR_HEIGHT * 1.4, 8)).toBe(9 * 60);
    expect(minuteAtOffset(HOUR_HEIGHT * 40, 8)).toBe(23 * 60 + 30);
  });
});

describe('findConflicts', () => {
  const swim = {
    id: 'swim',
    title: 'Schwimmen',
    date: at(2026, 10, 5, 16),
    endDate: at(2026, 10, 5, 17),
    kids: ['anna'],
    responsibleParent: 'Tanja',
  };

  it('finds an event for the same child at an overlapping time', () => {
    const out = findConflicts([swim], { date: at(2026, 10, 5, 16, 30), kids: ['anna'] });
    expect(out).toHaveLength(1);
    expect(out[0].kids).toEqual(['anna']);
    expect(out[0].parent).toBe(false);
  });

  it('finds an event for the same parent', () => {
    const out = findConflicts([swim], { date: at(2026, 10, 5, 15, 30), responsibleParent: 'Tanja' });
    expect(out.map((c) => c.parent)).toEqual([true]);
  });

  it('ignores back-to-back events, other people and all-day events', () => {
    const party = { id: 'p', title: 'Geburtstag', date: at(2026, 10, 5, 9), allDay: true, kids: ['anna'] };
    expect(findConflicts([swim, party], { date: at(2026, 10, 5, 17), kids: ['anna'] })).toEqual([]);
    expect(findConflicts([swim], { date: at(2026, 10, 5, 16), kids: ['max'] })).toEqual([]);
    expect(findConflicts([swim], { date: at(2026, 10, 5, 16), kids: ['anna'], allDay: true })).toEqual([]);
  });

  it('ignores the event being edited, and every occurrence of its series', () => {
    const series = { ...swim, recurrence: { freq: 'weekly', interval: 1 } };
    const candidate = { date: at(2026, 10, 12, 16), kids: ['anna'] };
    expect(findConflicts([series], candidate)).toHaveLength(1);
    expect(findConflicts([series], candidate, { ignoreId: 'swim' })).toEqual([]);
  });
});

describe('ICS export of all-day events', () => {
  it('writes the DATE form with an exclusive end', () => {
    const ics = buildICS([
      { id: 'h', title: 'Ferien', date: at(2026, 10, 26, 9), endDate: at(2026, 10, 31), allDay: true },
      { id: 'b', title: 'Geburtstag', date: at(2026, 7, 14), allDay: true },
    ]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261026\r\nDTEND;VALUE=DATE:20261031');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260714\r\nDTEND;VALUE=DATE:20260715');
  });
});
