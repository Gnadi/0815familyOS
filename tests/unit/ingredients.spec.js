import { describe, expect, it } from 'vitest';
import { joinQuantities, normalizeTitle, parseIngredient } from '../../src/utils/ingredients';
import { planShoppingAdditions } from '../../src/services/shopping';
import { PRODUCT_ICONS, guessProductIcon } from '../../src/utils/productIcons';
import { DEFAULT_SHOPPING_ITEMS } from '../../src/constants/defaultShoppingItems';

describe('parseIngredient', () => {
  it('splits an amount with an attached unit', () => {
    expect(parseIngredient('500g Mehl')).toEqual({ quantity: '500 g', title: 'Mehl' });
  });

  it('splits an amount with a spaced unit', () => {
    expect(parseIngredient('2 EL Olivenöl')).toEqual({ quantity: '2 EL', title: 'Olivenöl' });
  });

  it('splits an ASCII fraction', () => {
    expect(parseIngredient('1/2 TL Salz')).toEqual({ quantity: '1/2 TL', title: 'Salz' });
  });

  it('splits a unicode fraction', () => {
    expect(parseIngredient('½ Zitrone')).toEqual({ quantity: '½', title: 'Zitrone' });
  });

  it('handles a bare count with no unit', () => {
    expect(parseIngredient('2 Eier')).toEqual({ quantity: '2', title: 'Eier' });
  });

  it('leaves a line without a leading number alone', () => {
    expect(parseIngredient('Salz und Pfeffer')).toEqual({
      quantity: '',
      title: 'Salz und Pfeffer',
    });
  });

  it('does not swallow the noun when more words follow the unit', () => {
    expect(parseIngredient('500g Mehl Type 405')).toEqual({
      quantity: '500 g',
      title: 'Mehl Type 405',
    });
  });

  it('keeps a bare number as the title rather than producing an empty product', () => {
    expect(parseIngredient('2')).toEqual({ quantity: '', title: '2' });
  });

  it('handles decimals and comma decimals', () => {
    expect(parseIngredient('0.5 l Milch')).toEqual({ quantity: '0.5 l', title: 'Milch' });
    expect(parseIngredient('1,5 kg Kartoffeln')).toEqual({
      quantity: '1,5 kg',
      title: 'Kartoffeln',
    });
  });

  it('returns empty for blank input', () => {
    expect(parseIngredient('')).toEqual({ quantity: '', title: '' });
    expect(parseIngredient(null)).toEqual({ quantity: '', title: '' });
  });
});

describe('normalizeTitle', () => {
  it('is case and whitespace insensitive', () => {
    expect(normalizeTitle('  Mehl  ')).toBe(normalizeTitle('mehl'));
    expect(normalizeTitle('Rote   Zwiebel')).toBe('rote zwiebel');
  });

  it('ignores a parenthetical qualifier', () => {
    expect(normalizeTitle('Mehl (Type 405)')).toBe('mehl');
  });

  it('drops a trailing comma', () => {
    expect(normalizeTitle('Petersilie,')).toBe('petersilie');
  });

  // Folding diacritics would collide Müsli with Musli for no benefit.
  it('does not fold umlauts', () => {
    expect(normalizeTitle('Müsli')).not.toBe(normalizeTitle('Musli'));
    expect(normalizeTitle('Öl')).toBe('öl');
  });
});

describe('joinQuantities', () => {
  it('joins distinct quantities without inventing arithmetic', () => {
    expect(joinQuantities(['500 g', '200 g'])).toBe('500 g + 200 g');
  });

  it('collapses duplicates', () => {
    expect(joinQuantities(['2', '2', '2'])).toBe('2');
  });

  it('drops empties', () => {
    expect(joinQuantities(['', '1 EL', ''])).toBe('1 EL');
    expect(joinQuantities(['', ''])).toBe('');
  });

  it('truncates beyond three', () => {
    expect(joinQuantities(['1', '2', '3', '4'])).toBe('1 + 2 + 3 …');
  });
});

describe('planShoppingAdditions', () => {
  const open = { id: 'open1', title: 'Mehl', done: false };
  const done = { id: 'done1', title: 'Zucker', done: true, completedAt: new Date(1000) };
  const doneNewer = { id: 'done2', title: 'Zucker', done: true, completedAt: new Date(9000) };

  it('creates entries that are not on the list', () => {
    const plan = planShoppingAdditions({ lines: ['2 Eier'], existingItems: [] });
    expect(plan).toEqual([
      { key: 'eier', title: 'Eier', quantities: ['2'], count: 1, quantity: '2', action: 'create', existingId: null },
    ]);
  });

  it('skips an item that is already open', () => {
    const plan = planShoppingAdditions({ lines: ['500g Mehl'], existingItems: [open] });
    expect(plan[0].action).toBe('skip');
    expect(plan[0].existingId).toBe('open1');
  });

  it('reactivates a completed item instead of duplicating it', () => {
    const plan = planShoppingAdditions({ lines: ['100g Zucker'], existingItems: [done] });
    expect(plan[0].action).toBe('reactivate');
    expect(plan[0].existingId).toBe('done1');
  });

  it('reactivates the most recently completed match', () => {
    const plan = planShoppingAdditions({
      lines: ['100g Zucker'],
      existingItems: [done, doneNewer],
    });
    expect(plan[0].existingId).toBe('done2');
  });

  it('prefers an open item over a completed one', () => {
    const plan = planShoppingAdditions({
      lines: ['100g Zucker'],
      existingItems: [done, { id: 'openZ', title: 'Zucker', done: false }],
    });
    expect(plan[0].action).toBe('skip');
  });

  it('collapses the same ingredient from several recipes and counts it', () => {
    const plan = planShoppingAdditions({
      lines: ['1 Zwiebel', '2 Zwiebeln', '½ Zwiebel'],
      existingItems: [],
    });
    const zwiebel = plan.find((p) => p.key === 'zwiebel');
    expect(zwiebel.count).toBe(2);
    expect(zwiebel.quantity).toBe('1 + ½');
  });

  it('ignores blank lines', () => {
    expect(planShoppingAdditions({ lines: ['', '   '], existingItems: [] })).toEqual([]);
  });
});

describe('guessProductIcon', () => {
  // The regressions that motivated the word-boundary rule: "ei" sits near the
  // top of the keyword list and used to match as a substring.
  it.each([
    ['Reis', '🍚'],
    ['Fleisch', '🥩'],
    ['Rinderhackfleisch', '🥩'],
    ['Weintrauben', '🍇'],
    ['Nutella', '🍫'],
    ['Eier', '🥚'],
    ['Ei', '🥚'],
    ['2 Eier', '🥚'],
    ['Bio Vollmilch', '🥛'],
    ['Mehl', '🌾'],
    ['Teewurst', '🌭'],
    ['Parmesan', '🧀'],
    ['Rinderhackfleisch', '🥩'],
    ['Passierte Tomaten', '🍅'],
  ])('maps %s to %s', (name, icon) => {
    expect(guessProductIcon(name)).toBe(icon);
  });

  it('falls back to the trolley', () => {
    expect(guessProductIcon('Schraubenzieher')).toBe('🛒');
    expect(guessProductIcon('')).toBe('🛒');
  });

  it('agrees with the hand-picked icons on the seeded products', () => {
    // These ship with an explicit icon, so they double as a fixture.
    const mismatches = DEFAULT_SHOPPING_ITEMS.filter(
      (item) => guessProductIcon(item.de) !== item.icon && guessProductIcon(item.en) !== item.icon,
    ).map((item) => `${item.de}/${item.en}: got ${guessProductIcon(item.de)}, want ${item.icon}`);
    expect(mismatches).toEqual([]);
  });
});

describe('PRODUCT_ICONS picker set', () => {
  it('has no duplicates, so every slot is a distinct choice', () => {
    expect(new Set(PRODUCT_ICONS).size).toBe(PRODUCT_ICONS.length);
  });

  it('stays a full multiple of the 8-column grid', () => {
    expect(PRODUCT_ICONS.length % 8).toBe(0);
  });

  it('contains every icon guessProductIcon can return', () => {
    const guessed = new Set(
      DEFAULT_SHOPPING_ITEMS.map((item) => guessProductIcon(item.de)).filter((i) => i !== '🛒'),
    );
    for (const icon of guessed) expect(PRODUCT_ICONS).toContain(icon);
  });
});
