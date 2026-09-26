import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDefaultOptions } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { formatDate, formatWeekRange, getWeekDays, weekStart } from '../../src/utils/date';

describe('weekStart', () => {
  it('returns the Monday of the week', () => {
    // Friday, 2 Oct 2026 → Monday, 28 Sep 2026
    const d = weekStart(new Date(2026, 9, 2, 15, 30));
    expect(d.getDay()).toBe(1);
    expect(d.getDate()).toBe(28);
    expect(d.getMonth()).toBe(8);
  });

  it('keeps a Sunday in the week that started the Monday before', () => {
    const d = weekStart(new Date(2026, 9, 4));
    expect(d.getDate()).toBe(28);
  });
});

describe('formatWeekRange', () => {
  const week = (y, m, d) => getWeekDays(new Date(y, m, d));

  it('shows the full month when the week stays in one month', () => {
    expect(formatWeekRange(week(2026, 9, 7))).toBe('October 2026');
  });

  it('shows both months when the week spans two', () => {
    expect(formatWeekRange(week(2026, 9, 2))).toBe('Sep – Oct 2026');
  });

  it('shows both years across a year boundary', () => {
    expect(formatWeekRange(week(2026, 11, 31))).toBe('Dec 2026 – Jan 2027');
  });
});

describe('in German', () => {
  beforeAll(() => setDefaultOptions({ locale: de, weekStartsOn: 1 }));
  afterAll(() => setDefaultOptions({ locale: enUS, weekStartsOn: 1 }));

  it('writes a two-month week without dots', () => {
    expect(formatWeekRange(getWeekDays(new Date(2026, 9, 2)))).toBe('Sep – Okt 2026');
  });

  it('puts the day before the month', () => {
    const d = new Date(2026, 9, 2, 10, 5);
    expect(formatDate(d, 'short')).toBe('2. Okt.');
    expect(formatDate(d, 'long')).toBe('2. Oktober');
    expect(formatDate(d, 'weekdayShort')).toBe('Fr., 2. Okt.');
    expect(formatDate(d, 'withYear')).toBe('2. Okt. 2026');
  });
});

describe('formatDate in English', () => {
  it('keeps the month before the day', () => {
    const d = new Date(2026, 9, 2);
    expect(formatDate(d, 'short')).toBe('Oct 2');
    expect(formatDate(d, 'weekdayShort')).toBe('Fri, Oct 2');
  });
});
