import { describe, expect, it } from 'vitest';
import {
  EMPTY_SEARCH_RESULT,
  eventSearchText,
  foldText,
  searchEvents,
  searchTokens,
} from '../../src/utils/eventSearch';

const at = (y, m, d, h = 9, min = 0) => new Date(y, m - 1, d, h, min, 0);

// "Now" for every test, so past/upcoming ordering is deterministic.
const NOW = at(2026, 6, 15, 12, 0);

const stored = (over = {}) => ({
  id: 's1',
  title: 'Elternabend',
  description: '',
  category: 'general',
  kids: [],
  responsibleParent: '',
  date: at(2026, 6, 20),
  ...over,
});

// Shaped exactly like what services/calendarFeeds.js hands to the calendar.
const synced = (over = {}) => ({
  id: 'feed:sub_1:abc',
  title: 'Turnen',
  description: '',
  category: 'general',
  kids: [],
  responsibleParent: '',
  date: at(2026, 6, 18, 16, 0),
  source: 'subscription',
  subscriptionId: 'sub_1',
  subscriptionLabel: 'Schule',
  externalId: 'uid-1',
  ...over,
});

const context = {
  categoryLabel: (id) => ({ general: 'Allgemein', health: 'Gesundheit' }[id] || ''),
  kidName: (id) => ({ k1: 'Lena', k2: 'Mats' }[id] || ''),
};

const search = (events, query, options) =>
  searchEvents(events, query, { now: NOW, context, ...options });

const titles = (list) => list.map((ev) => ev.title);

describe('foldText', () => {
  it('lowercases and strips diacritics', () => {
    expect(foldText('Zahnärztin')).toBe('zahnarztin');
    expect(foldText('Straße')).toBe('strasse');
  });

  it('survives null and undefined', () => {
    expect(foldText(undefined)).toBe('');
    expect(foldText(null)).toBe('');
  });
});

describe('searchTokens', () => {
  it('splits on whitespace and drops duplicates', () => {
    expect(searchTokens('  Lena   Zahnarzt lena ')).toEqual(['lena', 'zahnarzt']);
  });

  it('is empty for a blank query', () => {
    expect(searchTokens('   ')).toEqual([]);
  });
});

describe('eventSearchText', () => {
  it('covers the fields the card shows plus the source calendar', () => {
    const text = eventSearchText(
      synced({ title: 'Turnen', description: 'Halle 2', responsibleParent: 'Anna', kids: ['k1'] }),
      context,
    );
    expect(text).toContain('turnen');
    expect(text).toContain('halle 2');
    expect(text).toContain('anna');
    expect(text).toContain('lena');
    expect(text).toContain('allgemein');
    expect(text).toContain('schule');
  });

  it('covers the place an event is at', () => {
    const text = eventSearchText(synced({ location: 'Flughafen Hörsching' }), context);
    expect(text).toContain('flughafen');
    // The place goes through the same umlaut handling as every other field.
    expect(text).toContain('horsching');
    expect(text).toContain('hoersching');
  });

  it('carries both spellings of an umlaut', () => {
    const text = eventSearchText(stored({ title: 'München' }), null);
    expect(text).toContain('munchen');
    expect(text).toContain('muenchen');
  });
});

describe('searchEvents', () => {
  it('returns nothing for a blank query', () => {
    expect(search([stored()], '   ')).toBe(EMPTY_SEARCH_RESULT);
  });

  it('finds a stored event by title, case- and accent-insensitively', () => {
    const res = search([stored({ title: 'Zahnärztin' })], 'zahnarzt');
    expect(titles(res.upcoming)).toEqual(['Zahnärztin']);
    expect(res.total).toBe(1);
  });

  it('matches an ASCII spelling of an umlaut both ways', () => {
    const events = [stored({ title: 'München Ausflug' })];
    expect(search(events, 'muenchen').total).toBe(1);
    expect(search(events, 'munchen').total).toBe(1);
    expect(search(events, 'münchen').total).toBe(1);
  });

  it('requires every term to match', () => {
    const events = [
      stored({ id: 'a', title: 'Zahnarzt Lena', kids: ['k1'] }),
      stored({ id: 'b', title: 'Zahnarzt Mats', kids: ['k2'] }),
    ];
    expect(titles(search(events, 'zahnarzt lena').upcoming)).toEqual(['Zahnarzt Lena']);
    expect(search(events, 'zahnarzt turnen').total).toBe(0);
  });

  it('searches description, responsible parent, kid and category', () => {
    const events = [
      stored({ id: 'a', title: 'Termin', description: 'Impfung auffrischen' }),
      stored({ id: 'b', title: 'Abholen', responsibleParent: 'Anna' }),
      stored({ id: 'c', title: 'Schwimmen', kids: ['k2'] }),
      stored({ id: 'd', title: 'Kontrolle', category: 'health' }),
    ];
    expect(titles(search(events, 'impfung').upcoming)).toEqual(['Termin']);
    expect(titles(search(events, 'anna').upcoming)).toEqual(['Abholen']);
    expect(titles(search(events, 'mats').upcoming)).toEqual(['Schwimmen']);
    expect(titles(search(events, 'gesundheit').upcoming)).toEqual(['Kontrolle']);
  });

  describe('synced calendars', () => {
    it('finds events from a subscribed calendar next to the family\'s own', () => {
      const res = search([stored({ title: 'Turnbeutel packen' }), synced()], 'turn');
      expect(titles(res.upcoming)).toEqual([synced().title, 'Turnbeutel packen']);
    });

    it('finds every event of a subscribed calendar by the calendar name', () => {
      const res = search(
        [
          synced({ id: 'feed:sub_1:a', title: 'Turnen', externalId: 'a' }),
          synced({ id: 'feed:sub_1:b', title: 'Wandertag', externalId: 'b', date: at(2026, 6, 25) }),
          stored({ title: 'Einkaufen' }),
        ],
        'schule',
      );
      expect(titles(res.upcoming)).toEqual(['Turnen', 'Wandertag']);
    });

    it('finds an event imported once from an .ics file', () => {
      const imported = stored({ id: 'i1', title: 'Ferienbeginn', source: 'import', externalId: 'x' });
      expect(titles(search([imported], 'ferien').upcoming)).toEqual(['Ferienbeginn']);
    });

    it('carries the annotations laid over a feed event', () => {
      // saveFeedAnnotation() is what puts a kid or a parent on a synced event;
      // useEvents merges it in before search ever sees the event.
      const annotated = synced({ kids: ['k1'], responsibleParent: 'Anna' });
      expect(search([annotated], 'lena').total).toBe(1);
      expect(search([annotated], 'anna').total).toBe(1);
    });
  });

  it('finds a one-off event far outside the recurrence window', () => {
    const faraway = stored({ title: 'Urlaub Norwegen', date: at(2029, 7, 1) });
    expect(titles(search([faraway], 'norwegen').upcoming)).toEqual(['Urlaub Norwegen']);
  });

  it('ignores events without a usable date', () => {
    expect(search([stored({ date: null }), stored({ date: new Date('nonsense') })], 'elternabend').total)
      .toBe(0);
  });

  it('puts upcoming events first and past ones newest-first behind them', () => {
    const events = [
      stored({ id: 'p1', title: 'Sport A', date: at(2026, 5, 1) }),
      stored({ id: 'p2', title: 'Sport B', date: at(2026, 6, 1) }),
      stored({ id: 'u1', title: 'Sport C', date: at(2026, 7, 1) }),
      stored({ id: 'u2', title: 'Sport D', date: at(2026, 6, 30) }),
    ];
    const res = search(events, 'sport');
    expect(titles(res.upcoming)).toEqual(['Sport D', 'Sport C']);
    expect(titles(res.past)).toEqual(['Sport B', 'Sport A']);
  });

  it('counts an event earlier today as upcoming, not as history', () => {
    const res = search([stored({ title: 'Frühstück', date: at(2026, 6, 15, 7, 0) })], 'fruhstuck');
    expect(res.upcoming).toHaveLength(1);
    expect(res.past).toHaveLength(0);
  });

  describe('recurring series', () => {
    const weekly = stored({
      id: 'w1',
      title: 'Turnen',
      date: at(2026, 1, 6, 16, 0),
      recurrence: { freq: 'weekly', interval: 1, until: null },
    });

    it('returns concrete occurrences around today rather than the master', () => {
      const res = search([weekly], 'turnen');
      expect(res.upcoming.length).toBeGreaterThan(0);
      expect(res.upcoming[0].date >= NOW).toBe(true);
      expect(res.upcoming[0].masterId).toBe('w1');
    });

    it('caps how much of one series can flood the results', () => {
      const res = search([weekly], 'turnen', { maxPerSeries: 3 });
      expect(res.upcoming.length + res.past.length).toBe(3);
    });

    it('falls back to the last occurrences of a series that has ended', () => {
      const ended = { ...weekly, recurrence: { freq: 'weekly', interval: 1, until: '2026-03-01' } };
      const res = search([ended], 'turnen', { maxPerSeries: 2 });
      expect(res.upcoming).toHaveLength(0);
      expect(res.past).toHaveLength(2);
      expect(res.past[0].date < NOW).toBe(true);
    });

    it('caps a synced series the same way', () => {
      const feedSeries = synced({
        title: 'Frühbetreuung',
        date: at(2026, 2, 2, 7, 30),
        recurrence: { freq: 'daily', interval: 1, until: null },
      });
      const res = search([feedSeries], 'schule', { maxPerSeries: 3 });
      expect(res.upcoming.length + res.past.length).toBe(3);
    });
  });

  it('reports truncation once more matches exist than fit', () => {
    const events = Array.from({ length: 8 }, (_, i) =>
      stored({ id: `e${i}`, title: `Sport ${i}`, date: at(2026, 7, i + 1) }),
    );
    const res = search(events, 'sport', { limit: 5 });
    expect(res.upcoming).toHaveLength(5);
    expect(res.total).toBe(8);
    expect(res.truncated).toBe(true);
  });

  it('does not report truncation when everything fits', () => {
    const res = search([stored({ title: 'Sport' })], 'sport', { limit: 5 });
    expect(res.truncated).toBe(false);
  });

  it('fills the remaining room with past events once upcoming ones run out', () => {
    const events = [
      stored({ id: 'u1', title: 'Sport A', date: at(2026, 7, 1) }),
      stored({ id: 'p1', title: 'Sport B', date: at(2026, 6, 1) }),
      stored({ id: 'p2', title: 'Sport C', date: at(2026, 5, 1) }),
    ];
    const res = search(events, 'sport', { limit: 2 });
    expect(titles(res.upcoming)).toEqual(['Sport A']);
    expect(titles(res.past)).toEqual(['Sport B']);
    expect(res.truncated).toBe(true);
  });
});
