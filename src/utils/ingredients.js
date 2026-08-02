// Turning a recipe's free-text ingredient lines into shopping-list entries.
//
// Ingredients are stored as plain strings with the quantity written inline
// ("500g Mehl") — the recipe form's own placeholder trains people to write them
// that way. Nothing here tries to *understand* units: no conversion, no
// summing, no ontology. It splits off a leading quantity so that "500 g Mehl"
// and "200g Mehl" both reduce to the title "Mehl" and can be deduplicated,
// and so the quantity lands in the field the shopping item already has.

// Unicode fractions people actually type, plus ASCII fractions and decimals.
const FRACTIONS = '¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞';
const NUMBER = `(?:\\d+[.,]?\\d*(?:\\s*\\/\\s*\\d+)?|\\d*\\s*[${FRACTIONS}]|[${FRACTIONS}])`;
// A unit is a short word, optionally abbreviated with a dot: g, kg, ml, EL,
// TL, Stk., tbsp, cups. Capped at 5 letters so "500g Mehl Type 405" cannot
// swallow the noun.
const UNIT = '(?:[\\p{L}]{1,5}\\.?)';
const LEADING = new RegExp(`^\\s*(${NUMBER})\\s*(${UNIT})?\\s+(.*)$`, 'u');

// Below this the remainder is not a plausible product name, so the split is
// abandoned and the whole line stays as the title (e.g. a bare "2").
const MIN_TITLE_LENGTH = 2;

export function parseIngredient(line) {
  const raw = String(line || '').trim();
  if (!raw) return { quantity: '', title: '' };

  const match = LEADING.exec(raw);
  if (!match) return { quantity: '', title: raw };

  const [, amount, unit, rest] = match;
  const title = (rest || '').trim();
  if (title.length < MIN_TITLE_LENGTH) return { quantity: '', title: raw };

  const quantity = unit ? `${amount.trim()} ${unit.trim()}` : amount.trim();
  return { quantity, title };
}

// Dedupe key. Deliberately does NOT fold diacritics: in German that would
// collide Müsli with Musli for no benefit, and it would mangle "Öl".
export function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // "Mehl (Type 405)" and "Mehl" are one thing
    .replace(/[,;]+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Several distinct quantities for the same product are joined rather than
// added up — "500g" + "2 EL" has no meaning without a unit model, and guessing
// one would be worse than showing the user what the recipes actually said.
const MAX_JOINED_QUANTITIES = 3;

export function joinQuantities(quantities) {
  const distinct = [...new Set(quantities.filter(Boolean))];
  if (distinct.length === 0) return '';
  if (distinct.length <= MAX_JOINED_QUANTITIES) return distinct.join(' + ');
  return `${distinct.slice(0, MAX_JOINED_QUANTITIES).join(' + ')} …`;
}
