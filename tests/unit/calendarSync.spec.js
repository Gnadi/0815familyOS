import { describe, expect, it } from 'vitest';
import {
  annotationDocId,
  applyAnnotations,
  dedupeFeedEvents,
  fallbackUid,
  hasAnnotation,
  indexAnnotations,
  isFeedEvent,
  isOrphanedSubscriptionEvent,
  normalizeFeedUrl,
  selectSyncableEvents,
  virtualEventId,
  withStableUids,
} from '../../src/utils/calendarSync';
import { parseICS } from '../../src/utils/icsParser';

describe('withStableUids', () => {
  it('derives a UID for events that ship without one', () => {
    const date = new Date(2026, 0, 15, 10, 0, 0);
    const [ev] = withStableUids([{ title: 'Zahnarzt', date }]);
    expect(ev.uid).toBe(fallbackUid({ title: 'Zahnarzt', date }));
  });

  it('leaves an existing UID untouched', () => {
    const [ev] = withStableUids([{ uid: 'keep-me', title: 'x', date: new Date() }]);
    expect(ev.uid).toBe('keep-me');
  });

  it('derives the same UID on a re-sync of the same event', () => {
    const make = () => ({ title: 'Turnen', date: new Date(2026, 2, 3, 16, 0, 0) });
    expect(withStableUids([make()])[0].uid).toBe(withStableUids([make()])[0].uid);
  });
});

describe('dedupeFeedEvents', () => {
  it('keeps one event per UID', () => {
    const out = dedupeFeedEvents([
      { uid: 'a', title: 'first' },
      { uid: 'a', title: 'second' },
      { uid: 'b', title: 'other' },
    ]);
    expect(out).toHaveLength(2);
  });

  it('prefers the series master over a single-occurrence override', () => {
    const out = dedupeFeedEvents([
      { uid: 'series', title: 'moved instance', recurrenceId: '20260401T090000' },
      { uid: 'series', title: 'master' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('master');
  });

  it('drops events without a UID', () => {
    expect(dedupeFeedEvents([{ title: 'no uid' }])).toHaveLength(0);
  });
});

describe('selectSyncableEvents', () => {
  const cutoff = new Date(2026, 0, 1);

  it('drops one-off events before the cutoff', () => {
    const out = selectSyncableEvents([{ uid: 'a', date: new Date(2024, 5, 1) }], cutoff);
    expect(out).toHaveLength(0);
  });

  it('keeps recurring masters that started before the cutoff', () => {
    const out = selectSyncableEvents(
      [{ uid: 'a', date: new Date(2024, 5, 1), recurrence: { freq: 'weekly', interval: 1 } }],
      cutoff,
    );
    expect(out).toHaveLength(1);
  });

  it('keeps everything when no cutoff is given', () => {
    const out = selectSyncableEvents([{ uid: 'a', date: new Date(2000, 0, 1) }], null);
    expect(out).toHaveLength(1);
  });

  it('drops events without a usable date', () => {
    const out = selectSyncableEvents(
      [{ uid: 'a' }, { uid: 'b', date: new Date('nonsense') }],
      cutoff,
    );
    expect(out).toHaveLength(0);
  });
});

describe('virtualEventId', () => {
  it('is stable for the same subscription and UID', () => {
    expect(virtualEventId('sub_1', 'u1')).toBe(virtualEventId('sub_1', 'u1'));
  });

  it('differs per subscription and per UID', () => {
    const base = virtualEventId('sub_1', 'u1');
    expect(virtualEventId('sub_2', 'u1')).not.toBe(base);
    expect(virtualEventId('sub_1', 'u2')).not.toBe(base);
  });

  it('is recognisable as a feed event, unlike a stored document id', () => {
    expect(isFeedEvent({ id: virtualEventId('sub_1', 'u1') })).toBe(true);
    expect(isFeedEvent({ id: 'aB3xYz9QwErTyUiOpAsD' })).toBe(false);
    expect(isFeedEvent({})).toBe(false);
    expect(isFeedEvent(null)).toBe(false);
  });

  it('stays collision-free across a realistic calendar', () => {
    const ids = new Set();
    for (let i = 0; i < 5000; i += 1) ids.add(virtualEventId('sub_1', `event-${i}@icloud.com`));
    expect(ids.size).toBe(5000);
  });
});

describe('annotationDocId', () => {
  it('is stable, so saving an annotation twice updates one document', () => {
    expect(annotationDocId('sub_1', 'u1')).toBe(annotationDocId('sub_1', 'u1'));
  });

  it('differs per subscription and per event', () => {
    const base = annotationDocId('sub_1', 'u1');
    expect(annotationDocId('sub_2', 'u1')).not.toBe(base);
    expect(annotationDocId('sub_1', 'u2')).not.toBe(base);
  });

  it('produces a legal Firestore document id from an awkward UID', () => {
    const id = annotationDocId('sub_1', 'weird/uid:with spaces@and.dots');
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(id).not.toMatch(/^__.*__$/);
  });
});

describe('hasAnnotation', () => {
  it('is false for an event carrying nothing the family added', () => {
    expect(hasAnnotation({ kids: [], responsibleParent: '', effortLevel: '', category: 'general' }))
      .toBe(false);
    expect(hasAnnotation({})).toBe(false);
    expect(hasAnnotation(null)).toBe(false);
  });

  it('is true as soon as any family field is set', () => {
    expect(hasAnnotation({ kids: ['k1'] })).toBe(true);
    expect(hasAnnotation({ responsibleParent: 'Anna' })).toBe(true);
    expect(hasAnnotation({ effortLevel: 'high' })).toBe(true);
    expect(hasAnnotation({ category: 'sport' })).toBe(true);
  });

  it('does not count the default category as an annotation', () => {
    expect(hasAnnotation({ category: 'general' })).toBe(false);
  });
});

describe('applyAnnotations', () => {
  const feedEvent = {
    id: 'feed:sub_a:abc',
    title: 'Turnen',
    date: new Date(2026, 2, 3, 16),
    category: 'general',
    kids: [],
    responsibleParent: '',
    effortLevel: '',
    source: 'subscription',
    subscriptionId: 'sub_a',
    externalId: 'u1',
  };

  const annotationDoc = (over = {}) => ({
    source: 'annotation',
    subscriptionId: 'sub_a',
    externalId: 'u1',
    category: 'sport',
    kids: ['k1'],
    responsibleParent: 'Anna',
    effortLevel: 'high',
    ...over,
  });

  it('overlays the family fields onto the matching feed event', () => {
    const [out] = applyAnnotations([feedEvent], indexAnnotations([annotationDoc()]));
    expect(out.category).toBe('sport');
    expect(out.kids).toEqual(['k1']);
    expect(out.responsibleParent).toBe('Anna');
    expect(out.effortLevel).toBe('high');
  });

  it('never lets an annotation override what the feed owns', () => {
    const [out] = applyAnnotations(
      [feedEvent],
      indexAnnotations([annotationDoc({ title: 'Gehackt', date: new Date(2000, 0, 1) })]),
    );
    expect(out.title).toBe('Turnen');
    expect(out.date).toBe(feedEvent.date);
  });

  it('leaves events without an annotation untouched', () => {
    const other = { ...feedEvent, externalId: 'u2' };
    const [out] = applyAnnotations([other], indexAnnotations([annotationDoc()]));
    expect(out).toBe(other);
  });

  it('does not apply one subscription\'s annotation to another', () => {
    const otherSub = { ...feedEvent, subscriptionId: 'sub_b' };
    const [out] = applyAnnotations([otherSub], indexAnnotations([annotationDoc()]));
    expect(out.responsibleParent).toBe('');
  });

  it('returns the input unchanged when there are no annotations', () => {
    const input = [feedEvent];
    expect(applyAnnotations(input, indexAnnotations([]))).toBe(input);
  });
});

describe('indexAnnotations', () => {
  it('ignores documents that are not annotations', () => {
    const index = indexAnnotations([
      { source: 'subscription', subscriptionId: 'sub_a', externalId: 'u1' },
      { title: 'Zahnarzt' },
      { source: 'annotation', subscriptionId: 'sub_a' },
    ]);
    expect(index.size).toBe(0);
  });
});

describe('isOrphanedSubscriptionEvent', () => {
  const live = new Set(['sub_live']);

  it('flags an event of a subscription that no longer exists', () => {
    expect(isOrphanedSubscriptionEvent(
      { source: 'subscription', subscriptionId: 'sub_gone' }, live,
    )).toBe(true);
  });

  it('flags a subscription event that lost its subscription id', () => {
    expect(isOrphanedSubscriptionEvent({ source: 'subscription' }, live)).toBe(true);
  });

  it('leaves events of a live subscription alone', () => {
    expect(isOrphanedSubscriptionEvent(
      { source: 'subscription', subscriptionId: 'sub_live' }, live,
    )).toBe(false);
  });

  it('never touches hand-created or file-imported events', () => {
    expect(isOrphanedSubscriptionEvent({ source: 'import', externalId: 'x' }, live)).toBe(false);
    expect(isOrphanedSubscriptionEvent({ title: 'Zahnarzt' }, live)).toBe(false);
    expect(isOrphanedSubscriptionEvent(null, live)).toBe(false);
  });

  it('flags an annotation whose subscription is gone, and spares a live one', () => {
    expect(isOrphanedSubscriptionEvent(
      { source: 'annotation', subscriptionId: 'sub_gone' }, live,
    )).toBe(true);
    expect(isOrphanedSubscriptionEvent(
      { source: 'annotation', subscriptionId: 'sub_live' }, live,
    )).toBe(false);
  });
});

describe('normalizeFeedUrl', () => {
  it('treats webcal and https as the same feed', () => {
    expect(normalizeFeedUrl('webcal://p1.icloud.com/pub/cal.ics'))
      .toBe(normalizeFeedUrl('https://p1.icloud.com/pub/cal.ics'));
  });

  it('ignores a trailing slash, host case and surrounding whitespace', () => {
    expect(normalizeFeedUrl('  https://P1.iCloud.com/pub/cal/  '))
      .toBe(normalizeFeedUrl('https://p1.icloud.com/pub/cal'));
  });

  it('keeps the path case, which real feeds depend on', () => {
    expect(normalizeFeedUrl('https://p1.icloud.com/pub/AbC'))
      .not.toBe(normalizeFeedUrl('https://p1.icloud.com/pub/abc'));
  });

  it('keeps different calendars apart', () => {
    expect(normalizeFeedUrl('https://p1.icloud.com/pub/a.ics'))
      .not.toBe(normalizeFeedUrl('https://p1.icloud.com/pub/b.ics'));
  });

  it('falls back to the raw string for something unparseable', () => {
    expect(normalizeFeedUrl('not a url/')).toBe('not a url');
  });
});

describe('parseICS', () => {
  const wrap = (body) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR`;

  it('does not let a VALARM overwrite the event title and description', () => {
    const { events } = parseICS(wrap([
      'BEGIN:VEVENT',
      'UID:evt-1',
      'SUMMARY:Elternabend',
      'DESCRIPTION:Aula der Schule',
      'DTSTART:20260310T180000',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'SUMMARY:Reminder',
      'DESCRIPTION:Erinnerung',
      'TRIGGER:-PT15M',
      'END:VALARM',
      'END:VEVENT',
    ].join('\r\n')));
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Elternabend');
    expect(events[0].description).toBe('Aula der Schule');
  });

  it('exposes RECURRENCE-ID so overrides can be told apart from the master', () => {
    const { events } = parseICS(wrap([
      'BEGIN:VEVENT',
      'UID:series-1',
      'SUMMARY:Turnen',
      'DTSTART:20260302T160000',
      'RRULE:FREQ=WEEKLY;INTERVAL=1',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:series-1',
      'RECURRENCE-ID:20260309T160000',
      'SUMMARY:Turnen (verlegt)',
      'DTSTART:20260309T173000',
      'END:VEVENT',
    ].join('\r\n')));
    expect(events).toHaveLength(2);
    expect(events[0].recurrenceId).toBeNull();
    expect(events[1].recurrenceId).toBe('20260309T160000');

    // The pair collapses to the single series master.
    const deduped = dedupeFeedEvents(events);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].title).toBe('Turnen');
  });

  it('skips cancelled events', () => {
    const { events } = parseICS(wrap([
      'BEGIN:VEVENT',
      'UID:evt-2',
      'SUMMARY:Abgesagt',
      'STATUS:CANCELLED',
      'DTSTART:20260310T180000',
      'END:VEVENT',
    ].join('\r\n')));
    expect(events).toHaveLength(0);
  });

  it('still reads a plain event with a preceding VTIMEZONE block', () => {
    const { events, calendarName } = parseICS(wrap([
      'X-WR-CALNAME:Familie',
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Berlin',
      'BEGIN:DAYLIGHT',
      'TZOFFSETTO:+0200',
      'END:DAYLIGHT',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      'UID:evt-3',
      'SUMMARY:Geburtstag',
      'DTSTART;VALUE=DATE:20260714',
      'END:VEVENT',
    ].join('\r\n')));
    expect(calendarName).toBe('Familie');
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Geburtstag');
  });
});
