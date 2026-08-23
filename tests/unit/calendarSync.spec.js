import { describe, expect, it } from 'vitest';
import {
  classifyExistingEvents,
  dedupeFeedEvents,
  isOrphanedSubscriptionEvent,
  fallbackUid,
  normalizeFeedUrl,
  pickCanonicalDoc,
  selectSyncableEvents,
  subscriptionEventId,
  withStableUids,
} from '../../src/utils/calendarSync';
import { parseICS } from '../../src/utils/icsParser';

describe('subscriptionEventId', () => {
  it('is stable for the same subscription and UID', () => {
    const a = subscriptionEventId('sub_1', 'ABC-123@icloud.com');
    const b = subscriptionEventId('sub_1', 'ABC-123@icloud.com');
    expect(a).toBe(b);
  });

  it('differs per subscription and per UID', () => {
    const base = subscriptionEventId('sub_1', 'uid-a');
    expect(subscriptionEventId('sub_2', 'uid-a')).not.toBe(base);
    expect(subscriptionEventId('sub_1', 'uid-b')).not.toBe(base);
  });

  it('produces a legal Firestore document id', () => {
    const id = subscriptionEventId('sub_1', 'weird/uid:with spaces@and.dots');
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(id).not.toMatch(/^__.*__$/);
    expect(id.length).toBeLessThan(1500);
  });

  it('stays collision-free across a realistic calendar', () => {
    const ids = new Set();
    for (let i = 0; i < 5000; i += 1) {
      ids.add(subscriptionEventId('sub_1', `event-${i}@icloud.com`));
    }
    expect(ids.size).toBe(5000);
  });
});

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

describe('pickCanonicalDoc', () => {
  const canonical = 'ics_sub_uid_deadbeef';

  it('returns nothing to keep when the event is new', () => {
    expect(pickCanonicalDoc(canonical, [], [])).toEqual({ keep: null, drop: [] });
  });

  it('keeps the deterministic document and drops racing duplicates', () => {
    const random = { id: 'random1' };
    const exact = { id: canonical };
    const { keep, drop } = pickCanonicalDoc(canonical, [random, exact]);
    expect(keep).toBe(exact);
    expect(drop).toEqual([random]);
  });

  it('collapses several legacy duplicates onto one document', () => {
    const docs = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }];
    const { keep, drop } = pickCanonicalDoc(canonical, docs);
    expect(keep).toBe(docs[0]);
    expect(drop).toEqual([docs[1], docs[2]]);
  });

  it('adopts a file-imported copy instead of creating a second one', () => {
    const imported = { id: 'imported1' };
    const { keep, drop } = pickCanonicalDoc(canonical, [], [imported]);
    expect(keep).toBe(imported);
    expect(drop).toEqual([]);
  });

  it('prefers a document already owned by the subscription over an import', () => {
    const owned = { id: 'owned1' };
    const imported = { id: 'imported1' };
    const { keep, drop } = pickCanonicalDoc(canonical, [owned], [imported]);
    expect(keep).toBe(owned);
    expect(drop).toEqual([imported]);
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
});

describe('classifyExistingEvents', () => {
  const liveSubscriptionIds = new Set(['sub_a', 'sub_b']);
  const entry = (id, data) => ({ id, data });

  const classify = (entries) => classifyExistingEvents({
    entries,
    subscriptionId: 'sub_a',
    liveSubscriptionIds,
  });

  it('groups the subscription\'s own events by UID', () => {
    const a1 = entry('1', { source: 'subscription', subscriptionId: 'sub_a', externalId: 'u1' });
    const a2 = entry('2', { source: 'subscription', subscriptionId: 'sub_a', externalId: 'u1' });
    const { owned } = classify([a1, a2]);
    expect(owned.get('u1')).toEqual([a1, a2]);
  });

  it('never claims events belonging to another live subscription', () => {
    const other = entry('1', { source: 'subscription', subscriptionId: 'sub_b', externalId: 'u1' });
    const { owned, adoptable, orphans } = classify([other]);
    expect(owned.size).toBe(0);
    expect(adoptable.size).toBe(0);
    expect(orphans).toEqual([]);
  });

  it('treats events of a dead subscription as both adoptable and orphaned', () => {
    const stranded = entry('1', {
      source: 'subscription', subscriptionId: 'sub_dead', externalId: 'u1',
    });
    const { adoptable, orphans } = classify([stranded]);
    expect(adoptable.get('u1')).toEqual([stranded]);
    expect(orphans).toEqual([stranded]);
  });

  it('orphans a stranded event even when it has no UID to adopt it by', () => {
    const stranded = entry('1', { source: 'subscription', subscriptionId: 'sub_dead' });
    const { adoptable, orphans } = classify([stranded]);
    expect(adoptable.size).toBe(0);
    expect(orphans).toEqual([stranded]);
  });

  it('offers file imports for adoption without orphaning them', () => {
    const imported = entry('1', { source: 'import', externalId: 'u1' });
    const { adoptable, orphans } = classify([imported]);
    expect(adoptable.get('u1')).toEqual([imported]);
    expect(orphans).toEqual([]);
  });

  it('ignores events the user created by hand', () => {
    const manual = entry('1', { title: 'Zahnarzt' });
    const { owned, adoptable, orphans } = classify([manual]);
    expect(owned.size).toBe(0);
    expect(adoptable.size).toBe(0);
    expect(orphans).toEqual([]);
  });

  it('resolves a re-added calendar to one document per event, not two', () => {
    // What the user hit: removal stranded the old feed, re-subscribing built a
    // second copy. The stranded one is adopted, so nothing is duplicated.
    const stranded = entry('old', {
      source: 'subscription', subscriptionId: 'sub_dead', externalId: 'u1',
    });
    const { owned, adoptable, orphans } = classify([stranded]);
    const { keep, drop } = pickCanonicalDoc(
      'ics_sub_a_u1_hash',
      owned.get('u1') || [],
      adoptable.get('u1') || [],
    );
    expect(keep).toBe(stranded);
    expect(drop).toEqual([]);
    // Adopted, so the sweep must not delete it afterwards.
    expect(orphans).toEqual([stranded]);
    expect(orphans.filter((o) => o !== keep)).toEqual([]);
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
