// Builds the initial in-memory state for demo mode (see demoStore.js): one
// family with two kids and a realistic week of events, tasks, meals, gifts,
// shopping items, recipes, a vaccination, and two vault entries.
//
// Localization happens outside React (this runs from plain service modules),
// so the locale is resolved the same way I18nProvider does on mount and the
// strings come straight from the locale dictionaries via a tiny local lookup.
//
// IMPORTANT: this module must never import from ../lib/firebase.

import en from '../i18n/locales/en';
import de from '../i18n/locales/de';
import { LOCALE_STORAGE_KEY, matchLocale } from '../i18n/config';
import { DEFAULT_SHOPPING_ITEMS } from '../constants/defaultShoppingItems';

const DEMO_UID = 'demo-user';
const DEMO_FAMILY_ID = 'demo-family';

// Static AES-256-GCM key (bytes 0..31, base64url). The document vault expects
// family.encryptionKeyJwk to exist; secrecy is irrelevant for a device-local
// demo that never uploads anything.
const DEMO_ENCRYPTION_JWK = {
  kty: 'oct',
  k: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8',
  alg: 'A256GCM',
  ext: true,
  key_ops: ['encrypt', 'decrypt'],
};

function resolveLocale() {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return (
      matchLocale(stored) || matchLocale(window.navigator?.language) || 'en'
    );
  } catch {
    return 'en';
  }
}

// Mirrors I18nContext's dotted lookup with English fallback.
function makeT(dict) {
  return (key) =>
    key.split('.').reduce((acc, p) => (acc == null ? acc : acc[p]), dict) ??
    key.split('.').reduce((acc, p) => (acc == null ? acc : acc[p]), en) ??
    key;
}

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

export function buildSeed() {
  const locale = resolveLocale();
  const t = makeT(locale === 'de' ? de : en);

  // Staggered creation times keep client-side "newest first" sorts stable.
  let seq = 0;
  const stamp = () => new Date(Date.now() - ++seq * 60000);
  const meta = () => {
    const created = stamp();
    return { createdAt: created, updatedAt: created };
  };

  const family = {
    name: t('demo.familyName'),
    inviteCode: 'DEMO42',
    createdBy: DEMO_UID,
    memberIds: [DEMO_UID],
    encryptionKeyJwk: DEMO_ENCRYPTION_JWK,
    kids: [
      { id: 'kid_emma', name: t('demo.kid1'), color: 'violet', birthday: isoInDays(18, -7) },
      { id: 'kid_ben', name: t('demo.kid2'), color: 'sky', birthday: isoInDays(74, -4) },
    ],
    cooks: [],
    giftRecipients: [],
    customCategories: [],
    calendarSubscriptions: [],
    giftBudget: 100,
    createdAt: new Date(),
  };

  const userDoc = {
    uid: DEMO_UID,
    email: null,
    displayName: t('demo.userName'),
    familyId: DEMO_FAMILY_ID,
    createdAt: new Date(),
  };

  const event = (title, date, category, kids = [], extras = {}) => ({
    familyId: DEMO_FAMILY_ID,
    userId: DEMO_UID,
    title,
    description: '',
    category,
    date,
    kids,
    // responsibleParent holds the member's displayName (see EventFormModal),
    // not a uid.
    responsibleParent: extras.assigned ? t('demo.userName') : '',
    effortLevel: '',
    recurrence: extras.recurrence || null,
    ...meta(),
  });

  const task = (title, dueDate, status, priority, category, extras = {}) => ({
    familyId: DEMO_FAMILY_ID,
    userId: DEMO_UID,
    title,
    description: '',
    status,
    priority,
    category,
    points: extras.points ?? 1,
    dueDate,
    assigneeIds: extras.assigned ? [DEMO_UID] : [],
    progress: extras.progress ?? (status === 'completed' ? 100 : 0),
    recurrence: null,
    completedAt: status === 'completed' ? at(-1, 18) : null,
    ...meta(),
  });

  const recipe = (id, key, category) => [
    id,
    {
      familyId: DEMO_FAMILY_ID,
      userId: DEMO_UID,
      title: t(`demo.${key}Title`),
      sourceUrl: '',
      ingredients: t(`demo.${key}Ingredients`).split('\n'),
      instructions: t(`demo.${key}Steps`).split('\n'),
      category,
      notes: '',
      ...meta(),
    },
  ];

  const shoppingItem = (title, icon, extras = {}) => ({
    familyId: DEMO_FAMILY_ID,
    userId: DEMO_UID,
    title,
    quantity: extras.quantity || '',
    icon,
    urgent: Boolean(extras.urgent),
    offer: false,
    ifConvenient: false,
    done: Boolean(extras.done),
    ...(extras.done ? { seeded: true } : {}),
    completedAt: extras.done ? stamp() : null,
    ...meta(),
  });

  const collections = new Map([
    [
      'events',
      new Map([
        ['demo_ev_soccer', event(t('demo.evSoccer'), at(0, 15), 'sports', ['kid_emma'], { assigned: true })],
        ['demo_ev_grandparents', event(t('demo.evGrandparents'), at(0, 18, 30), 'family', ['kid_emma', 'kid_ben'])],
        ['demo_ev_dentist', event(t('demo.evDentist'), at(1, 9), 'health', ['kid_ben'], { assigned: true })],
        ['demo_ev_swim', event(t('demo.evSwim'), at(2, 16), 'sports', ['kid_emma'], { recurrence: { freq: 'weekly', interval: 1, until: null } })],
        ['demo_ev_market', event(t('demo.evMarket'), at(4, 10), 'general')],
        ['demo_ev_party', event(t('demo.evParty'), at(6, 14), 'family', ['kid_emma'])],
      ]),
    ],
    [
      'tasks',
      new Map([
        ['demo_task_bike', task(t('demo.taskBike'), at(1, 18), 'inProgress', 'high', 'maintenance', { assigned: true, progress: 50 })],
        ['demo_task_camp', task(t('demo.taskCamp'), at(3, 12), 'planned', 'urgent', 'general', { assigned: true })],
        ['demo_task_passports', task(t('demo.taskPassports'), at(10, 12), 'backlog', 'normal', 'general')],
        ['demo_task_plants', task(t('demo.taskPlants'), at(-1, 12), 'completed', 'low', 'maintenance')],
      ]),
    ],
    [
      'gifts',
      new Map([
        ['demo_gift_lego', { familyId: DEMO_FAMILY_ID, kidId: 'kid_emma', title: t('demo.giftLego'), price: 45, status: 'idea', notes: '', ...meta() }],
        ['demo_gift_book', { familyId: DEMO_FAMILY_ID, kidId: 'kid_emma', title: t('demo.giftBook'), price: 20, status: 'bought', notes: '', ...meta() }],
      ]),
    ],
    [
      'vaccinations',
      new Map([
        ['demo_vacc_tetanus', { familyId: DEMO_FAMILY_ID, userId: DEMO_UID, kidId: 'kid_ben', name: t('demo.vaccTetanus'), status: 'next_up', date: at(9, 12), ...meta() }],
      ]),
    ],
    [
      'recipes',
      new Map([
        recipe('demo_recipe_bolognese', 'recipe1', 'dinner'),
        recipe('demo_recipe_curry', 'recipe2', 'dinner'),
      ]),
    ],
    [
      'mealPlanEntries',
      new Map([
        ['demo_meal_today', { familyId: DEMO_FAMILY_ID, userId: DEMO_UID, date: at(0, 12), slot: 'dinner', recipeId: 'demo_recipe_bolognese', text: '', cookId: null, cookType: null, cookName: '', ...meta() }],
        ['demo_meal_tomorrow', { familyId: DEMO_FAMILY_ID, userId: DEMO_UID, date: at(1, 12), slot: 'dinner', recipeId: null, text: t('demo.mealTomorrow'), cookId: null, cookType: null, cookName: '', ...meta() }],
      ]),
    ],
    [
      'shoppingItems',
      new Map([
        ['demo_shop_milk', shoppingItem(t('demo.shopMilk'), '🥛', { urgent: true })],
        ['demo_shop_juice', shoppingItem(t('demo.shopJuice'), '🧃')],
        ['demo_shop_candles', shoppingItem(t('demo.shopCandles'), '🎂')],
        ...DEFAULT_SHOPPING_ITEMS.map((item, i) => [
          `demo_shop_seed_${i}`,
          shoppingItem(item[locale] || item.en, item.icon, { done: true }),
        ]),
      ]),
    ],
    [
      'documents',
      new Map([
        ['demo_doc_contract', { familyId: DEMO_FAMILY_ID, userId: DEMO_UID, type: 'document', title: t('demo.docContract'), category: 'school', notes: '', date: at(-30, 12), fileUrl: null, filePublicId: null, fileName: null, awardedTo: null, ...meta() }],
        ['demo_doc_swim', { familyId: DEMO_FAMILY_ID, userId: DEMO_UID, type: 'trophy', title: t('demo.trophySwim'), category: 'swimming', notes: '', date: at(-14, 12), fileUrl: null, filePublicId: null, fileName: null, awardedTo: t('demo.kid1'), ...meta() }],
      ]),
    ],
  ]);

  return { collections, family, userDoc };
}
