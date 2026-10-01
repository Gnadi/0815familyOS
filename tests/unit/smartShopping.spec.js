import { describe, expect, it } from 'vitest';
import { DAY, daysBetween, predictProduct, tripsOf } from '../../src/utils/consumption';
import {
  ageInYears,
  householdPortions,
  kidPortion,
  normalizeHousehold,
} from '../../src/utils/household';
import { parseAmount, scaleIngredient } from '../../src/utils/ingredients';
import {
  dueProducts,
  indexShoppingItems,
  isFreshProduct,
  mealPlanLines,
  nextShoppingDate,
  planWeeklyProposal,
  productDocId,
  productKey,
  shoppingSuggestions,
} from '../../src/utils/smartShopping';

const NOW = new Date(2026, 9, 1, 10, 0); // Thu 1 Oct 2026, 10:00

const daysAgo = (n, hour = 10) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const product = (title, agoList, extras = {}) => ({
  id: `fam_${title}`,
  key: productKey(title),
  title,
  purchases: agoList.map((n, i) => ({ id: `p${i}`, at: daysAgo(n) })),
  stillHaveAt: null,
  fresh: null,
  muted: false,
  ...extras,
});

describe('tripsOf', () => {
  it('merges purchases within twelve hours into one trip', () => {
    const trips = tripsOf([
      { at: daysAgo(2, 10) },
      { at: daysAgo(2, 11) },
      { at: daysAgo(0, 9) },
    ]);
    expect(trips).toHaveLength(2);
  });

  it('sorts unordered entries and ignores junk', () => {
    const trips = tripsOf([{ at: daysAgo(1) }, null, { at: 'not a date' }, { at: daysAgo(5) }]);
    expect(trips.map((d) => daysBetween(d, NOW))).toEqual([5, 1]);
  });
});

describe('predictProduct', () => {
  it('is still learning below three trips', () => {
    expect(predictProduct(product('Milch', [8, 4]), NOW).status).toBe('learning');
  });

  it('predicts from the median interval', () => {
    const p = predictProduct(product('Milch', [12, 8, 4]), NOW);
    expect(p.status).toBe('predicted');
    expect(p.intervalDays).toBeCloseTo(4);
    expect(daysBetween(p.lastBought, p.dueAt)).toBe(4);
  });

  it('shrugs off a single holiday gap', () => {
    // 3, 3, 3 then a 17-day holiday, then 3 again.
    const p = predictProduct(product('Milch', [29, 26, 23, 20, 3, 0]), NOW);
    expect(p.status).toBe('predicted');
    expect(p.intervalDays).toBeCloseTo(3);
  });

  it('refuses to predict a product bought at random', () => {
    expect(predictProduct(product('Kerzen', [60, 58, 10]), NOW).status).toBe('irregular');
  });

  it('pushes the due date out after "still have it"', () => {
    const plain = predictProduct(product('Milch', [12, 8, 4]), NOW);
    const snoozed = predictProduct(product('Milch', [12, 8, 4], { stillHaveAt: NOW }), NOW);
    expect(snoozed.dueAt.getTime()).toBeGreaterThan(plain.dueAt.getTime());
    expect(daysBetween(NOW, snoozed.dueAt)).toBe(2);
  });

  it('ignores a "still have it" from before the last purchase', () => {
    const p = predictProduct(product('Milch', [12, 8, 4], { stillHaveAt: daysAgo(6) }), NOW);
    expect(daysBetween(p.lastBought, p.dueAt)).toBe(4);
  });

  it('goes dormant when ignored for far longer than the rhythm', () => {
    expect(predictProduct(product('Milch', [40, 36, 32]), NOW).status).toBe('dormant');
  });

  it('reads Firestore-like timestamps', () => {
    const ts = (d) => ({ toDate: () => d });
    const p = predictProduct(
      { purchases: [12, 8, 4].map((n) => ({ at: ts(daysAgo(n)) })) },
      NOW,
    );
    expect(p.status).toBe('predicted');
  });
});

describe('household', () => {
  it('defaults adults to the member count and the mode to a running list', () => {
    expect(normalizeHousehold(undefined, 2)).toEqual({
      adults: 2,
      adultsIsDefault: true,
      shoppingMode: 'continuous',
      shoppingDay: 6,
    });
  });

  it('keeps valid settings and rejects junk', () => {
    expect(normalizeHousehold({ adults: 3, shoppingMode: 'weekly', shoppingDay: 0 }, 2)).toMatchObject({
      adults: 3,
      adultsIsDefault: false,
      shoppingMode: 'weekly',
      shoppingDay: 0,
    });
    expect(normalizeHousehold({ adults: 0, shoppingMode: 'x', shoppingDay: 9 }, 1)).toMatchObject({
      adults: 1,
      shoppingMode: 'continuous',
      shoppingDay: 6,
    });
  });

  it('computes age in full years', () => {
    expect(ageInYears('2019-10-02', NOW)).toBe(6);
    expect(ageInYears('2019-10-01', NOW)).toBe(7);
    expect(ageInYears('', NOW)).toBeNull();
    expect(ageInYears('2030-01-01', NOW)).toBeNull();
  });

  it('weights children by age', () => {
    expect(kidPortion(0)).toBe(0);
    expect(kidPortion(2)).toBe(0.5);
    expect(kidPortion(7)).toBe(0.7);
    expect(kidPortion(12)).toBe(0.9);
    expect(kidPortion(15)).toBe(1);
    expect(kidPortion(null)).toBe(0.7);
  });

  it('adds adults and children into portions', () => {
    const result = householdPortions(
      {
        household: { adults: 2 },
        kids: [
          { id: 'a', name: 'Emma', birthday: '2019-05-01' },
          { id: 'b', name: 'Ben', birthday: '2023-05-01' },
        ],
      },
      NOW,
    );
    expect(result.total).toBe(3.2);
    expect(result.kids.map((k) => k.portion)).toEqual([0.7, 0.5]);
  });
});

describe('scaleIngredient', () => {
  it('parses amounts in every way people write them', () => {
    expect(parseAmount('500')).toBe(500);
    expect(parseAmount('1,5')).toBe(1.5);
    expect(parseAmount('1/2')).toBe(0.5);
    expect(parseAmount('½')).toBe(0.5);
    expect(parseAmount('1 ½')).toBe(1.5);
    expect(parseAmount('abc')).toBeNull();
  });

  it('rounds weights to a natural step', () => {
    expect(scaleIngredient('500g Mehl', 0.8)).toBe('400 g Mehl');
    expect(scaleIngredient('500 g Mehl', 0.85)).toBe('430 g Mehl');
    expect(scaleIngredient('1 kg Kartoffeln', 0.8)).toBe('0,8 kg Kartoffeln');
    expect(scaleIngredient('2 EL Öl', 0.8)).toBe('1,5 EL Öl');
  });

  it('uses the decimal separator it is given', () => {
    expect(scaleIngredient('1 l Milch', 0.75, { decimalSeparator: '.' })).toBe('0.8 l Milch');
  });

  it('rounds countable things up', () => {
    expect(scaleIngredient('3 Eier', 0.8)).toBe('3 Eier');
    expect(scaleIngredient('3 Eier', 1.5)).toBe('5 Eier');
    expect(scaleIngredient('1 Dose Tomaten', 1.6)).toBe('2 Dose Tomaten');
    expect(scaleIngredient('½ Zitrone', 0.8)).toBe('0,5 Zitrone');
  });

  it('leaves what does not scale alone', () => {
    expect(scaleIngredient('1 Prise Salz', 2)).toBe('1 Prise Salz');
    expect(scaleIngredient('Salz und Pfeffer', 2)).toBe('Salz und Pfeffer');
    expect(scaleIngredient('500 g Mehl', 1.02)).toBe('500 g Mehl');
    expect(scaleIngredient('500 g Mehl', NaN)).toBe('500 g Mehl');
  });
});

describe('products', () => {
  it('builds a document id that starts with the family and survives slashes', () => {
    expect(productDocId('fam1', productKey('Saft 1/2 Liter'))).toBe('fam1_saft%201%2F2%20liter');
  });

  it('guesses fresh produce and respects an override', () => {
    expect(isFreshProduct('Vollkornbrot')).toBe(true);
    expect(isFreshProduct('Bio Vollmilch')).toBe(true);
    expect(isFreshProduct('Nudeln')).toBe(false);
    expect(isFreshProduct('Nudeln', true)).toBe(true);
    expect(isFreshProduct('Milch', false)).toBe(false);
  });
});

describe('nextShoppingDate', () => {
  it('finds the next occurrence of the weekday', () => {
    const sat = nextShoppingDate(NOW, 6);
    expect(sat.getDay()).toBe(6);
    expect(daysBetween(NOW, sat)).toBe(2);
  });

  it('counts today when today is the day', () => {
    const today = nextShoppingDate(NOW, 4);
    expect(daysBetween(NOW, today)).toBe(0);
    expect(today.getHours()).toBe(0);
  });
});

describe('suggestions', () => {
  const products = [
    product('Milch', [12, 8, 4]), // due today
    product('Kaffee', [43, 29, 15]), // due yesterday
    product('Klopapier', [63, 42, 21]), // due today, muted below
    product('Reis', [90, 60, 30, 1]), // just bought
  ];

  it('lists due products soonest first and drops muted ones', () => {
    const due = dueProducts({
      products: products.map((p) => (p.title === 'Klopapier' ? { ...p, muted: true } : p)),
      now: NOW,
      until: new Date(NOW.getTime() + 2 * DAY),
    });
    expect(due.map((d) => d.product.title)).toEqual(['Kaffee', 'Milch']);
  });

  it('does not suggest what is already on the list', () => {
    const items = [{ id: 'i1', title: 'milch', done: false }];
    const result = shoppingSuggestions({
      products,
      items,
      now: NOW,
      until: new Date(NOW.getTime() + 2 * DAY),
    });
    expect(result.map((d) => d.product.title)).not.toContain('Milch');
  });

  it('indexes the most recently completed tile per product', () => {
    const index = indexShoppingItems([
      { id: 'old', title: 'Milch', done: true, completedAt: daysAgo(9) },
      { id: 'new', title: 'Milch', done: true, completedAt: daysAgo(1) },
    ]);
    expect(index.doneByKey.get('milch').id).toBe('new');
  });
});

describe('mealPlanLines', () => {
  const recipes = [
    { id: 'r1', title: 'Pancakes', servings: 4, ingredients: ['500 g Mehl', '3 Eier'] },
    { id: 'r2', title: 'Salat', ingredients: ['1 Gurke'] },
  ];
  const from = new Date(2026, 9, 3);
  const to = new Date(2026, 9, 10);

  it('takes recipes planned in the window and scales them to the household', () => {
    const lines = mealPlanLines({
      entries: [
        { recipeId: 'r1', date: new Date(2026, 9, 4) },
        { recipeId: 'r2', date: new Date(2026, 9, 5) },
        { recipeId: 'r2', date: new Date(2026, 9, 10) }, // outside
        { recipeId: null, text: 'Pizza', date: new Date(2026, 9, 6) },
      ],
      recipes,
      from,
      to,
      portions: 2,
    });
    expect(lines).toEqual([
      { line: '250 g Mehl', source: 'Pancakes' },
      { line: '2 Eier', source: 'Pancakes' },
      { line: '1 Gurke', source: 'Salat' },
    ]);
  });
});

describe('planWeeklyProposal', () => {
  const tripDate = new Date(2026, 9, 3); // Saturday

  it('merges predictions and recipe ingredients and resolves list actions', () => {
    const plan = planWeeklyProposal({
      products: [product('Milch', [12, 8, 4]), product('Reis', [90, 60, 30, 1])],
      items: [
        { id: 'tile', title: 'Milch', done: true, completedAt: daysAgo(4) },
        { id: 'open', title: 'Eier', done: false },
      ],
      mealLines: [
        { line: '200 ml Milch', source: 'Pancakes' },
        { line: '3 Eier', source: 'Pancakes' },
        { line: '500 g Mehl', source: 'Pancakes' },
      ],
      tripDate,
      now: NOW,
    });

    const milk = plan.find((e) => e.key === 'milch');
    expect(milk).toMatchObject({ reasons: ['due', 'recipe'], action: 'reactivate', existingId: 'tile' });
    expect(milk.quantity).toBe('200 ml');
    expect(plan.find((e) => e.key === 'eier').action).toBe('skip');
    expect(plan.find((e) => e.key === 'mehl')).toMatchObject({ reasons: ['recipe'], action: 'create' });
    expect(plan.find((e) => e.key === 'reis')).toBeUndefined();
    // Due items first.
    expect(plan[0].key).toBe('milch');
  });

  it('includes what runs out before the shop after next', () => {
    // Bought every 7 days, last 3 days ago: due in 4 days, i.e. after this
    // Saturday's shop but before the next one.
    const plan = planWeeklyProposal({
      products: [product('Nudeln', [17, 10, 3])],
      tripDate,
      now: NOW,
    });
    expect(plan.map((e) => e.key)).toEqual(['nudeln']);
  });
});
