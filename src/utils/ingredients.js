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

// --- Scaling a recipe to the household -------------------------------------
//
// A recipe written "for 4" is put on the list for the portions the family
// actually eats (utils/household.js). Only the leading amount is touched, and
// only for units whose meaning survives multiplication; "1 Prise Salz" or a
// unit nobody listed here stays exactly as the recipe says.

const FRACTION_VALUES = {
  '¼': 1 / 4, '½': 1 / 2, '¾': 3 / 4, '⅐': 1 / 7, '⅑': 1 / 9, '⅒': 1 / 10,
  '⅓': 1 / 3, '⅔': 2 / 3, '⅕': 1 / 5, '⅖': 2 / 5, '⅗': 3 / 5, '⅘': 4 / 5,
  '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8,
};

// Things you buy whole: scaled amounts round up, because nobody buys 2.4 eggs
// and rounding down would leave the recipe short.
const COUNT_UNITS = new Set([
  'stk', 'st', 'stück', 'pck', 'pkg', 'pkt', 'pack', 'dose', 'dosen', 'glas',
  'bund', 'zehe', 'zehen', 'can', 'cans', 'tin', 'pc', 'pcs', 'piece',
]);

// Weights, volumes and spoons: rounded to a step that reads naturally.
const MEASURE_UNITS = new Set([
  'g', 'gr', 'kg', 'mg', 'ml', 'cl', 'dl', 'l', 'ltr', 'el', 'tl',
  'tbsp', 'tsp', 'cup', 'cups', 'oz', 'lb', 'lbs',
]);

// Below this the change is noise and the recipe's own wording is kept.
const SCALE_TOLERANCE = 0.05;

export function parseAmount(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  let m = new RegExp(`^(\\d+)?\\s*([${FRACTIONS}])$`, 'u').exec(s);
  if (m) return (m[1] ? Number(m[1]) : 0) + FRACTION_VALUES[m[2]];
  m = /^(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : null;
  if (/^\d+(?:[.,]\d+)?$/.test(s)) return Number(s.replace(',', '.'));
  return null;
}

function roundCount(value) {
  if (value <= 0.5) return 0.5;
  return Math.max(1, Math.ceil(value - 1e-9));
}

function roundMeasure(value) {
  if (value < 1) return Math.max(0.1, Math.round(value * 10) / 10);
  if (value < 10) return Math.round(value * 2) / 2;
  if (value < 100) return Math.round(value / 5) * 5;
  if (value < 1000) return Math.round(value / 10) * 10;
  return Math.round(value / 50) * 50;
}

function formatAmount(value, decimalSeparator) {
  return String(Math.round(value * 10) / 10).replace('.', decimalSeparator);
}

// "," for German, "." for English — whatever the locale writes in 1.5.
export function decimalSeparatorFor(locale) {
  return (1.5).toLocaleString(locale).replace(/\d/g, '') || '.';
}

export function scaleIngredient(line, factor, { decimalSeparator = ',' } = {}) {
  const raw = String(line || '').trim();
  if (!raw || !Number.isFinite(factor) || factor <= 0) return raw;
  if (Math.abs(factor - 1) < SCALE_TOLERANCE) return raw;

  const match = LEADING.exec(raw);
  if (!match) return raw;
  const [, amountText, unit, rest] = match;
  const title = (rest || '').trim();
  if (title.length < MIN_TITLE_LENGTH) return raw;

  const amount = parseAmount(amountText);
  if (!amount || amount <= 0) return raw;

  const unitKey = (unit || '').replace(/\.$/, '').toLowerCase();
  let scaled;
  if (!unit || COUNT_UNITS.has(unitKey)) scaled = roundCount(amount * factor);
  else if (MEASURE_UNITS.has(unitKey)) scaled = roundMeasure(amount * factor);
  else return raw;

  const amountOut = formatAmount(scaled, decimalSeparator);
  return unit ? `${amountOut} ${unit.trim()} ${title}` : `${amountOut} ${title}`;
}
