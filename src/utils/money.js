// Single source of truth for how myFAOS renders money (currently only the Gift
// Planner). Amounts are stored as plain numbers; the currency is a product
// decision, not per-user data, so it lives here rather than on the family doc.
//
// Formatting is locale-aware: German renders "1.234,00 €", English "€1,234.00".
// Previously this was hardcoded to en-US, which showed German families the
// wrong thousands/decimal separators.

export const CURRENCY = 'EUR';
export const CURRENCY_SYMBOL = '€';

const formatters = new Map();

function formatter(locale) {
  if (!formatters.has(locale)) {
    formatters.set(
      locale,
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: CURRENCY,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    );
  }
  return formatters.get(locale);
}

// formatMoney(1234.5, 'de') → "1.234,50 €"
export function formatMoney(amount, locale = 'en') {
  const n = Number(amount);
  return formatter(locale).format(Number.isFinite(n) ? n : 0);
}
