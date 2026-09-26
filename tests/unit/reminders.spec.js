import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTIFICATION_PREFS,
  collectReminders,
  dueReminders,
  nextFireAt,
  notificationBatch,
  normalizeNotificationPrefs,
  reminderText,
} from '../../src/utils/reminders';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// 10 March 2026, 14:00 local: room before and after inside the same day.
const NOW = new Date(2026, 2, 10, 14, 0, 0);
const at = (h, m = 0, dayOffset = 0) => new Date(2026, 2, 10 + dayOffset, h, m, 0);

const ME = { uid: 'u1', displayName: 'Alex' };
const KIDS = [{ id: 'k1', name: 'Anna' }, { id: 'k2', name: 'Lukas' }];

function collect(overrides = {}) {
  return collectReminders({ me: ME, kids: KIDS, now: NOW, prefs: {}, ...overrides });
}

describe('normalizeNotificationPrefs', () => {
  it('falls back to the defaults for missing or malformed values', () => {
    expect(normalizeNotificationPrefs(undefined)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(
      normalizeNotificationPrefs({ events: 'everyone', eventLeadMinutes: 7, tasks: 'yes', trackers: false }),
    ).toEqual({ ...DEFAULT_NOTIFICATION_PREFS, trackers: false });
  });
});

describe('event reminders', () => {
  const event = (overrides) => ({ id: 'e1', title: 'Swimming', date: at(15, 0), ...overrides });

  it('fires the lead time before the start and expires at the start', () => {
    const [r] = collect({ events: [event()] });
    expect(r.kind).toBe('event');
    expect(r.fireAt).toEqual(at(14, 30));
    expect(r.expiresAt).toEqual(at(15, 0));
  });

  it('honours the chosen lead time', () => {
    const [r] = collect({ events: [event()], prefs: { eventLeadMinutes: 10 } });
    expect(r.fireAt).toEqual(at(14, 50));
  });

  it('with "mine" skips events another parent is responsible for, but keeps unassigned ones', () => {
    const events = [
      event({ id: 'mine', responsibleParent: 'Alex' }),
      event({ id: 'theirs', responsibleParent: 'Sam' }),
      event({ id: 'nobody', responsibleParent: '' }),
    ];
    const ids = collect({ events }).map((r) => r.id.split(':')[1]);
    expect(ids.sort()).toEqual(['mine', 'nobody']);
    expect(collect({ events, prefs: { events: 'all' } })).toHaveLength(3);
    expect(collect({ events, prefs: { events: 'off' } })).toHaveLength(0);
  });

  it('gives an all-day event a morning reminder that lasts the day', () => {
    const [r] = collect({ events: [event({ date: at(0, 0) })] });
    expect(r.allDay).toBe(true);
    expect(r.fireAt).toEqual(at(8, 0));
    expect(r.expiresAt.getHours()).toBe(23);
  });

  it('drops events that already started and ones beyond the horizon', () => {
    const events = [event({ id: 'past', date: at(13, 0) }), event({ id: 'far', date: at(15, 0, 3) })];
    expect(collect({ events })).toHaveLength(0);
  });

  it('reminds of each occurrence of a recurring event separately', () => {
    const daily = event({ date: at(15, 0, -5), recurrence: { freq: 'daily', interval: 1 } });
    const reminders = collect({ events: [daily], horizonMs: 36 * HOUR });
    expect(reminders.map((r) => r.expiresAt)).toEqual([at(15, 0), at(15, 0, 1)]);
    expect(new Set(reminders.map((r) => r.id)).size).toBe(2);
  });

  it('gives a moved event a new id, so it is reminded of again', () => {
    const [a] = collect({ events: [event()] });
    const [b] = collect({ events: [event({ date: at(16, 0) })] });
    expect(a.id).not.toBe(b.id);
  });
});

describe('task reminders', () => {
  const task = (overrides) => ({ id: 't1', title: 'Pay Kita fee', status: 'planned', dueDate: at(9, 0), assigneeIds: [], ...overrides });

  it('reminds of a task due today in the morning, still sendable in the afternoon', () => {
    const [r] = collect({ tasks: [task()] });
    expect(r.fireAt).toEqual(at(8, 0));
    expect(dueReminders([r], new Set(), NOW)).toHaveLength(1);
  });

  it('only for my own or unassigned tasks, and never for completed ones', () => {
    const tasks = [
      task({ id: 'mine', assigneeIds: ['u1'] }),
      task({ id: 'theirs', assigneeIds: ['u2'] }),
      task({ id: 'done', status: 'completed' }),
    ];
    expect(collect({ tasks }).map((r) => r.id.split(':')[1])).toEqual(['mine']);
  });

  it('can be switched off', () => {
    expect(collect({ tasks: [task()], prefs: { tasks: false } })).toHaveLength(0);
  });
});

describe('vaccination reminders', () => {
  it('names the child and skips shots already given', () => {
    const vaccinations = [
      { id: 'v1', kidId: 'k1', name: 'MMR', status: 'pending', date: at(12, 0, 1) },
      { id: 'v2', kidId: 'k2', name: 'Tetanus', status: 'done', date: at(12, 0, 1) },
    ];
    const reminders = collect({ vaccinations });
    expect(reminders).toHaveLength(1);
    expect(reminders[0]).toMatchObject({ kind: 'vaccination', kidName: 'Anna', fireAt: at(8, 0, 1) });
  });
});

describe('tracker reminders', () => {
  const medicine = { id: 'tr1', name: 'Ibuprofen', emoji: '💊', kidIds: ['k1'], minIntervalHours: 6, dailyGoal: 0 };

  it('fires when the next dose becomes possible, keyed on the last dose', () => {
    const entries = [{ id: 'd1', trackerId: 'tr1', kidId: 'k1', at: at(11, 0) }];
    const [r] = collect({ trackers: [medicine], trackerEntries: entries });
    expect(r).toMatchObject({ kind: 'trackerDose', kidName: 'Anna', fireAt: at(17, 0) });
    expect(r.id).toContain('d1');
  });

  it('has nothing to say before the first dose or long after the last', () => {
    expect(collect({ trackers: [medicine] })).toHaveLength(0);
    const old = [{ id: 'd0', trackerId: 'tr1', kidId: 'k1', at: at(9, 0, -2) }];
    expect(collect({ trackers: [medicine], trackerEntries: old })).toHaveLength(0);
  });

  it('nudges in the evening while a daily goal is still open, and not once it is met', () => {
    const vitaminD = { id: 'tr2', name: 'Vitamin D', emoji: '☀️', kidIds: ['k2'], dailyGoal: 1 };
    const [r] = collect({ trackers: [vitaminD] });
    expect(r).toMatchObject({ kind: 'trackerGoal', kidName: 'Lukas', remaining: 1, fireAt: at(18, 0) });

    const logged = [{ id: 'x', trackerId: 'tr2', kidId: 'k2', at: at(9, 0) }];
    expect(collect({ trackers: [vitaminD], trackerEntries: logged })).toHaveLength(0);
  });
});

describe('scheduling helpers', () => {
  const reminders = collect({
    events: [{ id: 'e1', title: 'Swimming', date: at(15, 0) }],
    tasks: [{ id: 't1', title: 'Fee', status: 'planned', dueDate: at(9, 0), assigneeIds: [] }],
  });

  it('sorts by fire time and finds what is due and what comes next', () => {
    expect(reminders.map((r) => r.kind)).toEqual(['task', 'event']);
    expect(dueReminders(reminders, new Set(), NOW).map((r) => r.kind)).toEqual(['task']);
    expect(nextFireAt(reminders, NOW)).toEqual(at(14, 30));
  });

  it('never sends the same reminder twice', () => {
    const sent = new Set([reminders[0].id]);
    expect(dueReminders(reminders, sent, NOW)).toHaveLength(0);
  });
});

describe('reminderText', () => {
  const t = (key, vars) => `${key}${vars ? JSON.stringify(vars) : ''}`;
  const time = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

  it('writes the start time, and the place when there is one', () => {
    const base = { kind: 'event', title: 'Swimming', at: at(15, 0), allDay: false };
    expect(reminderText(base, t, time)).toEqual({ title: 'Swimming', body: 'notifications.eventAt{"time":"15:00"}' });
    expect(reminderText({ ...base, location: 'Pool' }, t, time).body).toBe(
      'notifications.eventAtWhere{"time":"15:00","location":"Pool"}',
    );
  });

  it("puts the tracker's emoji in the title", () => {
    const text = reminderText({ kind: 'trackerDose', title: 'Ibuprofen', emoji: '💊', kidName: 'Anna' }, t, time);
    expect(text.title).toBe('💊 Ibuprofen');
  });
});

describe('notificationBatch', () => {
  const t = (key, vars) => `${key}${vars ? JSON.stringify(vars) : ''}`;
  const time = () => '00:00';
  const task = (i) => ({ id: `task:${i}`, kind: 'task', title: `Task ${i}`, url: '/tasks', expiresAt: at(23, 0), fireAt: at(8, 0) });

  it('keeps a few reminders separate, tagged with their id', () => {
    const batch = notificationBatch([task(1), task(2)], t, time);
    expect(batch.map((n) => n.tag)).toEqual(['task:1', 'task:2']);
    expect(batch[0]).toMatchObject({ title: 'Task 1', url: '/tasks' });
  });

  it('folds a burst into one summary that lasts as long as its longest reminder', () => {
    const late = { ...task(4), expiresAt: at(23, 30) };
    const [summary, ...rest] = notificationBatch([task(1), task(2), task(3), late], t, time);
    expect(rest).toHaveLength(0);
    expect(summary).toMatchObject({ tag: 'summary', title: 'notifications.summaryTitle{"count":4}' });
    expect(summary.body).toBe('Task 1 · Task 2 · Task 3 · Task 4');
    expect(summary.expiresAt).toEqual(at(23, 30));
  });
});
