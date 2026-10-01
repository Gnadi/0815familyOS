// Household settings and how many portions a family eats per meal.
//
// Stored on the family document as `household`. Every field is optional and
// falls back to a sensible default, so families that never open the setting
// still get a working shopping list.

export const SHOPPING_MODES = ['continuous', 'weekly'];
export const DEFAULT_SHOPPING_MODE = 'continuous';
// Date#getDay() numbering: 0 = Sunday … 6 = Saturday.
export const DEFAULT_SHOPPING_DAY = 6;
export const MAX_ADULTS = 12;
// How many meals the family cooks in a week. Asked anew every week in the
// weekly proposal; the last answer is remembered as the next week's default.
export const DEFAULT_MEALS_PER_WEEK = 5;
export const MAX_MEALS_PER_WEEK = 21;

function isAdultCount(value) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_ADULTS;
}

// `memberCount` is the default for adults: most families have one app account
// per parent. A grandparent with an account is the case the setting is for.
export function normalizeHousehold(raw, memberCount = 1) {
  const h = raw && typeof raw === 'object' ? raw : {};
  const adultsSet = isAdultCount(h.adults);
  return {
    adults: adultsSet ? h.adults : Math.min(MAX_ADULTS, Math.max(1, memberCount || 1)),
    adultsIsDefault: !adultsSet,
    shoppingMode: SHOPPING_MODES.includes(h.shoppingMode) ? h.shoppingMode : DEFAULT_SHOPPING_MODE,
    shoppingDay:
      Number.isInteger(h.shoppingDay) && h.shoppingDay >= 0 && h.shoppingDay <= 6
        ? h.shoppingDay
        : DEFAULT_SHOPPING_DAY,
    mealsPerWeek:
      Number.isInteger(h.mealsPerWeek) && h.mealsPerWeek >= 0 && h.mealsPerWeek <= MAX_MEALS_PER_WEEK
        ? h.mealsPerWeek
        : DEFAULT_MEALS_PER_WEEK,
  };
}

// Full years from a YYYY-MM-DD birthday, or null when there is none.
export function ageInYears(birthday, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthday || ''));
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = now.getFullYear() - year;
  const beforeBirthday =
    now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

// Share of an adult portion a child eats, by age. Rough on purpose: the point
// is that a toddler does not count as a whole person when a recipe is scaled.
// A child under one mostly eats separately.
const UNKNOWN_AGE_PORTION = 0.7;

export function kidPortion(age) {
  if (age === null || age === undefined) return UNKNOWN_AGE_PORTION;
  if (age < 1) return 0;
  if (age < 4) return 0.5;
  if (age < 10) return 0.7;
  if (age < 14) return 0.9;
  return 1;
}

export function householdPortions({ household, kids = [], memberCount = 1 }, now = new Date()) {
  const { adults } = normalizeHousehold(household, memberCount);
  const kidRows = (kids || []).filter(Boolean).map((kid) => {
    const age = ageInYears(kid.birthday, now);
    return { id: kid.id, name: kid.name, age, portion: kidPortion(age) };
  });
  const total = adults + kidRows.reduce((sum, k) => sum + k.portion, 0);
  return { adults, kids: kidRows, total: Math.round(total * 10) / 10 };
}
