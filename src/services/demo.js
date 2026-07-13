import { signInAnonymously, updateProfile } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { ensureUserDoc } from './users';
import { addKid, createFamily, updateKid } from './families';
import { createEvent } from './events';
import { createTask } from './tasks';
import { createGift } from './gifts';
import { createVaccination } from './vaccinations';
import { createMealEntry } from './mealPlan';

// "Try the live demo" on the landing page: signs the visitor in anonymously
// and seeds a fresh, fully private sandbox family with realistic sample data.
// Every demo visitor gets their own family (anonymous Firebase users are
// isolated by the same security rules as real accounts), so the demo is fully
// interactive — nothing needs to be read-only.
//
// Requires the "Anonymous" sign-in provider to be enabled in the Firebase
// console (Authentication → Sign-in method).

function at(daysFromNow, hours, minutes = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function isoInDays(daysFromNow, yearOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setFullYear(d.getFullYear() + yearOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

async function seedDemoData({ familyId, uid, t }) {
  // Kids first — events, gifts and vaccinations reference their ids. Their
  // birthdays land a few weeks out so "Upcoming Birthdays" has content.
  const emma = await addKid(familyId, t('demo.kid1'), 0);
  const ben = await addKid(familyId, t('demo.kid2'), 1);
  await updateKid(familyId, emma.id, { birthday: isoInDays(18, -7) });
  await updateKid(familyId, ben.id, { birthday: isoInDays(74, -4) });

  const event = (title, date, category, kids = [], extras = {}) =>
    createEvent({
      familyId,
      userId: uid,
      title,
      description: '',
      date,
      category,
      kids,
      responsibleParent: extras.assigned ? uid : '',
      effortLevel: '',
      recurrence: extras.recurrence || null,
    });

  const task = (title, dueDate, status, priority, category, extras = {}) =>
    createTask({
      familyId,
      userId: uid,
      title,
      description: '',
      status,
      priority,
      category,
      points: extras.points ?? 1,
      dueDate,
      assigneeIds: extras.assigned ? [uid] : [],
      progress: extras.progress ?? 0,
      recurrence: null,
    });

  await Promise.all([
    // A populated week: something today, tomorrow, and later in the week,
    // including a weekly recurring class.
    event(t('demo.evSoccer'), at(0, 15, 0), 'sports', [emma.id], { assigned: true }),
    event(t('demo.evGrandparents'), at(0, 18, 30), 'family', [emma.id, ben.id]),
    event(t('demo.evDentist'), at(1, 9, 0), 'health', [ben.id], { assigned: true }),
    event(t('demo.evSwim'), at(2, 16, 0), 'sports', [emma.id], {
      recurrence: { freq: 'weekly', interval: 1 },
    }),
    event(t('demo.evMarket'), at(4, 10, 0), 'general'),
    event(t('demo.evParty'), at(6, 14, 0), 'family', [emma.id]),

    // Tasks across the board columns.
    task(t('demo.taskBike'), at(1, 18, 0), 'inProgress', 'high', 'maintenance', {
      assigned: true,
      progress: 50,
    }),
    task(t('demo.taskCamp'), at(3, 12, 0), 'planned', 'urgent', 'general', { assigned: true }),
    task(t('demo.taskPassports'), at(10, 12, 0), 'backlog', 'normal', 'general'),
    task(t('demo.taskPlants'), at(-1, 12, 0), 'completed', 'low', 'maintenance'),

    // Gift ideas for the upcoming birthday.
    createGift({ familyId, kidId: emma.id, title: t('demo.giftLego'), price: 45, status: 'idea', notes: '' }),
    createGift({ familyId, kidId: emma.id, title: t('demo.giftBook'), price: 20, status: 'bought', notes: '' }),

    // An upcoming vaccination so Health Alerts has something to show.
    createVaccination({
      familyId,
      userId: uid,
      kidId: ben.id,
      name: t('demo.vaccTetanus'),
      status: 'next_up',
      date: isoInDays(9),
    }),

    // Two planned dinners.
    createMealEntry({ familyId, userId: uid, date: at(0, 12), slot: 'dinner', text: t('demo.mealToday') }),
    createMealEntry({ familyId, userId: uid, date: at(1, 12), slot: 'dinner', text: t('demo.mealTomorrow') }),
  ]);
}

// Signs in anonymously, creates the sandbox family, and seeds it. Returns
// once the dashboard has data to show. Seeding failures after the family
// exists are swallowed — a partially seeded demo still works.
export async function startDemo({ t, locale }) {
  const cred = await signInAnonymously(auth);
  const user = cred.user;
  const displayName = t('demo.userName');
  try {
    await updateProfile(user, { displayName });
  } catch {
    /* cosmetic only */
  }
  await ensureUserDoc(user, { displayName });
  const { id: familyId } = await createFamily({
    name: t('demo.familyName'),
    uid: user.uid,
    locale,
  });
  try {
    await seedDemoData({ familyId, uid: user.uid, t });
  } catch {
    /* partial demo data is fine */
  }
  return familyId;
}
