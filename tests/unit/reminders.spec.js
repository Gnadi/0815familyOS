// The reminder centre. HealthAlerts computed a rolling 30-day vaccination
// window, UpcomingBirthdays a 60-day one and DailyPreview today's events and due
// tasks — three independent computations, all of them stuck on the dashboard,
// with nothing aggregating them and no surface carrying them anywhere else.
//
// useReminders consumes those same hooks rather than growing a fourth idea of
// "due soon". These cover the part that is genuinely new: what gets included,
// and the order it comes out in.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = { vaccinations: [], events: [], tasks: [], family: null };

vi.mock('../../src/hooks/useAuth', () => ({
  default: () => ({ userDoc: { familyId: 'fam1' }, family: state.family }),
}));
vi.mock('../../src/hooks/useVaccinations', () => ({
  default: () => ({ vaccinations: state.vaccinations }),
}));
vi.mock('../../src/hooks/useEvents', () => ({
  default: () => ({ events: state.events }),
}));
vi.mock('../../src/hooks/useTasks', () => ({
  default: () => ({ tasks: state.tasks }),
}));

const { default: useReminders } = await import('../../src/hooks/useReminders');

// The hook's only React dependency is useMemo, so calling it directly is enough
// and keeps this in the fast `npm test` suite rather than needing a renderer.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useMemo: (fn) => fn() };
});

const days = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d;
};

/** A YYYY-MM-DD birthday `n` days from today. */
const birthdayIn = (n) => {
  const d = days(n);
  return `1990-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

beforeEach(() => {
  state.vaccinations = [];
  state.events = [];
  state.tasks = [];
  state.family = { kids: [], giftRecipients: [] };
});

describe('what lands in the list', () => {
  it('includes a vaccination due inside the 30-day window', () => {
    state.vaccinations = [{ id: 'v1', name: 'MMR', kidId: 'k1', status: 'pending', date: days(10) }];
    state.family = { kids: [{ id: 'k1', name: 'Emma' }] };

    const [r] = useReminders();
    expect(r).toMatchObject({ kind: 'vaccination', title: 'MMR', personName: 'Emma', to: '/health' });
  });

  it('excludes one beyond the window', () => {
    state.vaccinations = [{ id: 'v1', name: 'MMR', status: 'pending', date: days(40) }];
    expect(useReminders()).toHaveLength(0);
  });

  it('excludes one already given', () => {
    state.vaccinations = [{ id: 'v1', name: 'MMR', status: 'done', date: days(2) }];
    expect(useReminders()).toHaveLength(0);
  });

  it('keeps an overdue vaccination, and marks it so', () => {
    // Exactly what needs chasing, so it must not be filtered out as "past".
    state.vaccinations = [{ id: 'v1', name: 'MMR', status: 'pending', date: days(-5) }];

    const [r] = useReminders();
    expect(r.overdue).toBe(true);
  });

  it('includes a task due today but not one due later', () => {
    state.tasks = [
      { id: 't1', title: 'Bins', status: 'planned', dueDate: days(0) },
      { id: 't2', title: 'Later', status: 'planned', dueDate: days(3) },
    ];

    const titles = useReminders().map((r) => r.title);
    expect(titles).toEqual(['Bins']);
  });

  it('excludes a completed task due today', () => {
    state.tasks = [{ id: 't1', title: 'Bins', status: 'completed', dueDate: days(0) }];
    expect(useReminders()).toHaveLength(0);
  });

  it('includes a birthday inside the nudge window', () => {
    state.family = { kids: [{ id: 'k1', name: 'Emma', birthday: birthdayIn(3) }] };

    const [r] = useReminders();
    expect(r).toMatchObject({ kind: 'birthday', title: 'Emma', to: '/gifts' });
    expect(r.daysUntil).toBe(3);
  });

  it('uses a tighter birthday window than the dashboard list', () => {
    // The dashboard shows 60 days, which is a browsing list. A nudge at 60 days
    // is noise, so the hook stops at 14.
    state.family = { kids: [{ id: 'k1', name: 'Emma', birthday: birthdayIn(40) }] };
    expect(useReminders()).toHaveLength(0);
  });

  it('includes gift recipients, who have birthdays for a reason', () => {
    state.family = {
      kids: [],
      giftRecipients: [{ id: 'r1', name: 'Grandma', birthday: birthdayIn(2) }],
    };
    expect(useReminders().map((r) => r.title)).toEqual(['Grandma']);
  });

  it('is empty when nothing is due', () => {
    expect(useReminders()).toEqual([]);
  });
});

describe('the order', () => {
  it('puts overdue ahead of everything else', () => {
    state.vaccinations = [{ id: 'v1', name: 'Overdue shot', status: 'pending', date: days(-2) }];
    state.tasks = [{ id: 't1', title: 'Today task', status: 'planned', dueDate: days(0) }];

    expect(useReminders().map((r) => r.title)).toEqual(['Overdue shot', 'Today task']);
  });

  it('sorts the rest by date', () => {
    state.vaccinations = [
      { id: 'v1', name: 'Later shot', status: 'pending', date: days(20) },
      { id: 'v2', name: 'Sooner shot', status: 'pending', date: days(4) },
    ];

    expect(useReminders().map((r) => r.title)).toEqual(['Sooner shot', 'Later shot']);
  });

  it('breaks a date tie by kind, so the order is stable', () => {
    state.tasks = [{ id: 't1', title: 'A task', status: 'planned', dueDate: days(0) }];
    state.vaccinations = [{ id: 'v1', name: 'A shot', status: 'pending', date: days(0) }];

    // Vaccination outranks a task on the same day.
    expect(useReminders().map((r) => r.kind)).toEqual(['vaccination', 'task']);
  });
});

describe('the ids', () => {
  it('carries the date, so yesterday cannot mark today as seen', () => {
    state.tasks = [{ id: 't1', title: 'Bins', status: 'planned', dueDate: days(0) }];
    const todayId = useReminders()[0].id;

    expect(todayId).toContain('t1');
    expect(todayId).toContain(new Date().toISOString().slice(0, 10));
  });

  it('is stable across calls for the same input', () => {
    state.vaccinations = [{ id: 'v1', name: 'MMR', status: 'pending', date: days(5) }];
    expect(useReminders()[0].id).toBe(useReminders()[0].id);
  });
});
