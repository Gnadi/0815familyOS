import { describe, expect, it } from 'vitest';
import {
  buildAssistantContext,
  matchOption,
  matchPeople,
  normalizeAssistantActions,
  normalizeDateString,
  normalizeTimeString,
  planToEventPayload,
  planToTaskPayload,
  toDateTime,
} from '../../src/utils/assistantPlan';

// A fixed "now" so relative dates and the allowed date window are stable:
// Monday, 21 September 2026, 08:30 local time.
const NOW = new Date(2026, 8, 21, 8, 30);

const CATEGORIES = [
  { id: 'general', label: 'General' },
  { id: 'health', label: 'Gesundheit' },
  { id: 'sports', label: 'Sport' },
];
const TASK_CATEGORIES = [
  { id: 'general', label: 'General' },
  { id: 'urgent', label: 'Dringend' },
];
const KIDS = [{ id: 'kid-1', name: 'Anna' }, { id: 'kid-2', name: 'Lukas' }];
const MEMBERS = [{ id: 'uid-1', name: 'Johannes' }, { id: 'uid-2', name: 'Steffi Gnadlinger' }];

const opts = (extra = {}) => ({
  now: NOW,
  categories: CATEGORIES,
  taskCategories: TASK_CATEGORIES,
  kids: KIDS,
  members: MEMBERS,
  defaultCategory: 'general',
  defaultTaskCategory: 'general',
  ...extra,
});

describe('normalizeDateString', () => {
  it('keeps a plain ISO day and the day part of a timestamp', () => {
    expect(normalizeDateString('2026-10-14', NOW)).toBe('2026-10-14');
    expect(normalizeDateString('2026-10-14T15:00:00Z', NOW)).toBe('2026-10-14');
  });

  it('resolves the relative words a model sometimes echoes instead of a date', () => {
    expect(normalizeDateString('tomorrow', NOW)).toBe('2026-09-22');
    expect(normalizeDateString('Übermorgen', NOW)).toBe('2026-09-23');
    expect(normalizeDateString('heute', NOW)).toBe('2026-09-21');
  });

  it('rejects impossible days rather than letting Date roll them over', () => {
    expect(normalizeDateString('2026-02-31', NOW)).toBe('');
    expect(normalizeDateString('2026-13-01', NOW)).toBe('');
  });

  // A hallucinated year is the one failure mode that would quietly bury an
  // event where nobody ever looks.
  it('rejects dates far outside the plausible window', () => {
    expect(normalizeDateString('2019-05-01', NOW)).toBe('');
    expect(normalizeDateString('2999-01-01', NOW)).toBe('');
    // Just inside the five-year window is kept; just outside is not.
    expect(normalizeDateString('2031-01-01', NOW)).toBe('2031-01-01');
    expect(normalizeDateString('2032-01-01', NOW)).toBe('');
  });
});

describe('normalizeTimeString', () => {
  it('accepts the shapes a model or a transcript produces', () => {
    expect(normalizeTimeString('15:00')).toBe('15:00');
    expect(normalizeTimeString('9')).toBe('09:00');
    expect(normalizeTimeString('9:5')).toBe('09:05');
    expect(normalizeTimeString('14:00:00')).toBe('14:00');
    expect(normalizeTimeString('7.30')).toBe('07:30');
  });

  it('drops anything out of range or unparsable', () => {
    expect(normalizeTimeString('25:00')).toBe('');
    expect(normalizeTimeString('12:99')).toBe('');
    expect(normalizeTimeString('nachmittags')).toBe('');
    expect(normalizeTimeString('')).toBe('');
  });
});

describe('matchOption', () => {
  it('matches by id, by label and by prefix, in that order', () => {
    expect(matchOption('health', CATEGORIES, 'general')).toBe('health');
    expect(matchOption('Gesundheit', CATEGORIES, 'general')).toBe('health');
    expect(matchOption('sport', CATEGORIES, 'general')).toBe('sports');
  });

  it('falls back instead of inventing a category', () => {
    expect(matchOption('Weltraum', CATEGORIES, 'general')).toBe('general');
    expect(matchOption('', CATEGORIES, 'general')).toBe('general');
  });
});

describe('matchPeople', () => {
  it('resolves names, ids and first names, and dedupes', () => {
    expect(matchPeople(['Anna', 'kid-2', 'Anna'], KIDS)).toEqual(['kid-1', 'kid-2']);
    expect(matchPeople(['Steffi'], MEMBERS)).toEqual(['uid-2']);
  });

  it('ignores names that are not in the family', () => {
    expect(matchPeople(['Mueller', ''], KIDS)).toEqual([]);
    expect(matchPeople(null, KIDS)).toEqual([]);
  });
});

describe('normalizeAssistantActions', () => {
  it('turns a proposed event into an editable plan entry', () => {
    const { actions, skipped } = normalizeAssistantActions(
      [
        {
          type: 'create_event',
          args: {
            title: '  Zahnarzt Anna  ',
            date: '2026-10-14',
            time: '15:00',
            endTime: '16:00',
            location: 'Dr. Meier',
            category: 'Gesundheit',
            kids: ['Anna'],
            responsible: 'Steffi',
          },
        },
      ],
      opts(),
    );
    expect(skipped).toBe(0);
    expect(actions[0]).toMatchObject({
      type: 'create_event',
      title: 'Zahnarzt Anna',
      date: '2026-10-14',
      time: '15:00',
      endTime: '16:00',
      category: 'health',
      kidIds: ['kid-1'],
      responsibleParent: 'Steffi Gnadlinger',
    });
  });

  it('defaults a missing time and falls back to the signed-in parent', () => {
    const { actions } = normalizeAssistantActions(
      [{ type: 'create_event', args: { title: 'Elternabend', date: 'tomorrow' } }],
      opts({ defaultResponsible: 'Johannes' }),
    );
    expect(actions[0]).toMatchObject({
      date: '2026-09-22',
      time: '09:00',
      category: 'general',
      responsibleParent: 'Johannes',
    });
  });

  // "until 14:00, starting 15:00" is a misheard range, not an overnight event.
  it('drops an end time that precedes the start', () => {
    const { actions } = normalizeAssistantActions(
      [{ type: 'create_event', args: { title: 'Turnen', date: '2026-09-22', time: '15:00', endTime: '14:00' } }],
      opts(),
    );
    expect(actions[0].endTime).toBe('');
  });

  it('gives a task without a due date today, and matches its assignees', () => {
    const { actions } = normalizeAssistantActions(
      [
        {
          type: 'create_task',
          args: { title: 'Pässe verlängern', priority: 'URGENT', category: 'Dringend', assignees: ['Johannes'], points: 3.4 },
        },
      ],
      opts(),
    );
    expect(actions[0]).toMatchObject({
      type: 'create_task',
      dueDate: '2026-09-21',
      priority: 'urgent',
      category: 'urgent',
      assigneeIds: ['uid-1'],
      points: 3,
    });
  });

  it('skips proposals that carry nothing usable, and counts them', () => {
    const { actions, skipped } = normalizeAssistantActions(
      [
        { type: 'create_event', args: { title: '', date: '2026-10-14' } },
        { type: 'create_event', args: { title: 'Kein Datum' } },
        { type: 'delete_everything', args: { title: 'nope' } },
        { type: 'add_shopping_item', args: { title: 'Milch', quantity: '2 l' } },
      ],
      opts(),
    );
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: 'add_shopping_item', title: 'Milch', quantity: '2 l' });
    expect(skipped).toBe(3);
  });

  it('survives a response that is not a list at all', () => {
    expect(normalizeAssistantActions(null, opts())).toEqual({ actions: [], skipped: 0 });
    expect(normalizeAssistantActions([null], opts()).skipped).toBe(1);
  });

  it('keeps only a valid recurrence', () => {
    const { actions } = normalizeAssistantActions(
      [
        { type: 'create_event', args: { title: 'Turnen', date: '2026-09-22', recurrence: { freq: 'weekly', interval: '2' } } },
        { type: 'create_event', args: { title: 'Kein Rhythmus', date: '2026-09-22', recurrence: { freq: 'hourly' } } },
      ],
      opts(),
    );
    expect(actions[0].recurrence).toEqual({ freq: 'weekly', interval: 2, until: null });
    expect(actions[1].recurrence).toBeNull();
  });
});

describe('plan -> service payloads', () => {
  it('builds the Date objects the event service expects', () => {
    const [action] = normalizeAssistantActions(
      [{ type: 'create_event', args: { title: 'Zahnarzt', date: '2026-10-14', time: '15:00', endTime: '15:45' } }],
      opts(),
    ).actions;
    const payload = planToEventPayload(action);
    expect(payload.date).toEqual(new Date(2026, 9, 14, 15, 0));
    expect(payload.endDate).toEqual(new Date(2026, 9, 14, 15, 45));
  });

  it('gives a task a due date at the default hour', () => {
    const [action] = normalizeAssistantActions(
      [{ type: 'create_task', args: { title: 'Reifen wechseln', dueDate: '2026-10-02' } }],
      opts(),
    ).actions;
    const payload = planToTaskPayload(action);
    expect(payload.dueDate).toEqual(new Date(2026, 9, 2, 9, 0));
    expect(payload.status).toBe('planned');
  });

  it('refuses to build a date out of nonsense', () => {
    expect(toDateTime('', '10:00')).toBeNull();
    expect(toDateTime('not-a-date', '10:00')).toBeNull();
  });
});

describe('buildAssistantContext', () => {
  it('sends only the clock, the language and first names', () => {
    const context = buildAssistantContext({
      now: NOW,
      locale: 'de',
      timezone: 'Europe/Vienna',
      categories: CATEGORIES,
      taskCategories: TASK_CATEGORIES,
      kids: KIDS,
      members: MEMBERS,
    });
    expect(context).toMatchObject({
      today: '2026-09-21',
      nowTime: '08:30',
      weekday: 'Monday',
      language: 'German',
      kids: ['Anna', 'Lukas'],
      members: ['Johannes', 'Steffi Gnadlinger'],
    });
    // No ids, no email addresses, nothing from Firestore beyond the roster.
    expect(JSON.stringify(context)).not.toContain('uid-1');
  });
});
