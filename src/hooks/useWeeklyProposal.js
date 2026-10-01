import { useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import useRecipes from './useRecipes';
import useMealPlan from './useMealPlan';
import { decimalSeparatorFor } from '../utils/ingredients';
import { MAX_MEALS_PER_WEEK, householdPortions, normalizeHousehold } from '../utils/household';
import { MIN_RECIPES_TO_SUGGEST, placeMeals, rankRecipes, suggestMeals } from '../utils/mealSuggestions';
import { mealPlanLines, nextShoppingDate, planWeeklyProposal, plannedMeals, tripId } from '../utils/smartShopping';
import { addShoppingItemsBulk } from '../services/shopping';
import { createMealEntry, markMealsShopped } from '../services/mealPlan';
import { updateHousehold } from '../services/families';

// Everything behind the weekly proposal (docs/smart-shopping.md): the meals
// of the week the next shop is for — how many, which are planned, which the
// family's recipes suggest — and the shopping list that follows from them.
//
// The meal choice lives here rather than in the sheet so the card on the
// shopping list counts the same proposal the sheet will show.
export default function useWeeklyProposal({ enabled, familyId, userId, family, items, products, locale }) {
  const { recipes } = useRecipes(enabled ? familyId : null);
  const { entries } = useMealPlan(enabled ? familyId : null);
  // The family's changes to the meals, for one trip: { trip, count, picks }.
  // Until they change something, the suggested defaults apply.
  const [choice, setChoice] = useState(null);

  const memberCount = family?.memberIds?.length || 1;
  const household = normalizeHousehold(family?.household, memberCount);
  const portions = householdPortions({ household: family?.household, kids: family?.kids, memberCount }).total;
  const tripDate = enabled ? nextShoppingDate(new Date(), household.shoppingDay) : null;
  const trip = tripDate ? tripId(tripDate) : null;

  const week = useMemo(() => {
    if (!trip) return null;
    const from = new Date(tripDate);
    const to = addDays(from, 7);
    const meals = plannedMeals({ entries, recipes, from, to });
    return {
      from,
      to,
      meals,
      plannedIds: new Set(meals.map((m) => m.recipe.id)),
      ranked: rankRecipes({ recipes, entries, from, to, seed: trip }),
    };
    // tripDate is derived from trip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip, entries, recipes]);

  const canSuggest = recipes.length >= MIN_RECIPES_TO_SUGGEST;

  // The family's choice for this trip, or the suggested default: last week's
  // number of meals, filled up from the ranking.
  const current = useMemo(() => {
    if (!week) return { count: 0, picks: [] };
    if (choice?.trip === trip) return choice;
    const count = Math.max(week.meals.length, household.mealsPerWeek);
    const picks = canSuggest
      ? suggestMeals({ ranked: week.ranked, exclude: week.plannedIds, count: count - week.meals.length }).map(
          (r) => ({ id: r.id, manual: false }),
        )
      : [];
    return { trip, count, picks };
  }, [week, choice, trip, household.mealsPerWeek, canSuggest]);

  // Picks resolved against live data: a recipe deleted or planned meanwhile
  // drops out.
  const rankById = useMemo(() => new Map((week?.ranked || []).map((r) => [r.recipe.id, r])), [week]);
  const picks = current.picks
    .filter((p) => rankById.has(p.id) && !week?.plannedIds.has(p.id))
    .map((p) => ({ ...rankById.get(p.id), manual: p.manual }));
  const count = Math.max(current.count, week?.meals.length || 0);
  const taken = new Set([...(week?.plannedIds || []), ...picks.map((p) => p.recipe.id)]);
  const candidates = (week?.ranked || []).filter((r) => !taken.has(r.recipe.id));

  const pickIds = picks.map((p) => p.recipe.id).join();
  const proposal = useMemo(() => {
    if (!week) return [];
    // Chosen recipes join the week's planned meals for the ingredient list.
    const pickEntries = picks.map((p) => ({ id: `pick-${p.recipe.id}`, recipeId: p.recipe.id, date: week.from }));
    const mealLines = mealPlanLines({
      entries: [...entries, ...pickEntries],
      recipes,
      from: week.from,
      to: week.to,
      portions,
      decimalSeparator: decimalSeparatorFor(locale),
      skipShopped: true,
    });
    return planWeeklyProposal({ products, items, mealLines, tripDate: week.from, now: new Date() });
    // `picks` is rebuilt every render; its ids are what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, entries, recipes, portions, locale, products, items, pickIds]);

  function update(next) {
    setChoice({
      trip,
      count: next.count ?? count,
      picks: (next.picks ?? picks).map((p) => ({ id: p.recipe.id, manual: p.manual })),
    });
  }

  const suggestion = (n, exclude = taken) =>
    suggestMeals({ ranked: week?.ranked || [], exclude, count: n }).map((recipe) => ({ recipe, manual: false }));

  const menu = {
    meals: week?.meals || [],
    picks,
    count,
    maxCount: MAX_MEALS_PER_WEEK,
    canSuggest,
    candidates,
    // More meals fill the new places with suggestions; fewer drop the last
    // chosen ones. Planned meals are changed in the week plan, not here.
    onCount(n) {
      const next = Math.min(MAX_MEALS_PER_WEEK, Math.max(week.meals.length, n));
      let nextPicks = picks.slice(0, Math.max(0, next - week.meals.length));
      if (canSuggest && next > count) {
        const open = next - week.meals.length - nextPicks.length;
        nextPicks = [...nextPicks, ...suggestion(Math.min(open, next - count))];
      }
      update({ count: next, picks: nextPicks });
    },
    onSwap(i) {
      const [replacement] = suggestion(1);
      if (!replacement) return;
      update({ picks: picks.map((p, j) => (j === i ? replacement : p)) });
    },
    onRemove(i) {
      update({ picks: picks.filter((_, j) => j !== i) });
    },
    onSuggest() {
      update({ picks: [...picks, ...suggestion(1)] });
    },
    onPick(recipe) {
      const nextPicks = [...picks, { recipe, manual: true }];
      update({ picks: nextPicks, count: Math.max(count, week.meals.length + nextPicks.length) });
    },
  };

  // Confirming plans the shop: the chosen recipes go on free days of the week
  // plan, every meal of the week counts as shopped for (so none is offered
  // again), the items carry the trip (so what was bought for it is not offered
  // again for it either), and the number of meals becomes next week's default.
  async function confirm(chosen) {
    const placed = placeMeals({ recipes: picks.map((p) => p.recipe), entries, from: week.from });
    const writes = [
      addShoppingItemsBulk({ familyId, userId, plan: chosen, items, products, list: 'main', proposedFor: trip }),
      markMealsShopped(week.meals.filter((m) => !m.shopped).map((m) => m.entry)),
      ...placed.map(({ recipe, date, slot }) =>
        createMealEntry({ familyId, userId, date, slot, recipeId: recipe.id, text: '', shopped: true }),
      ),
    ];
    if (count !== household.mealsPerWeek) {
      writes.push(updateHousehold(family.id, family.household, { mealsPerWeek: count }));
    }
    await Promise.all(writes);
    setChoice(null);
  }

  return {
    tripDate,
    proposal,
    proposalCount: proposal.filter((p) => p.action !== 'skip').length,
    menu,
    recipeCount: recipes.length,
    confirm,
  };
}
