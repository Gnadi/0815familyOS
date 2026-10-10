import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import WeekMealPlan from '../components/food/WeekMealPlan';
import RecipeList from '../components/food/RecipeList';
import RecipeFormModal from '../components/food/RecipeFormModal';
import RecipeDetailModal from '../components/food/RecipeDetailModal';
import CookingMode from '../components/food/CookingMode';
import WeekShoppingModal from '../components/food/WeekShoppingModal';
import useAuth from '../hooks/useAuth';
import useT from '../hooks/useT';
import useFamilyMembers from '../hooks/useFamilyMembers';
import useRecipes from '../hooks/useRecipes';
import useMealPlan from '../hooks/useMealPlan';
import useShoppingItems from '../hooks/useShoppingItems';
import { createRecipe, updateRecipe, deleteRecipe } from '../services/recipes';
import { createMealEntry, updateMealEntry, deleteMealEntry, markMealsShopped } from '../services/mealPlan';
import { addCook, removeCook } from '../services/families';
import { addShoppingItemsBulk, planShoppingAdditions } from '../services/shopping';
import { householdPortions } from '../utils/household';
import { decimalSeparatorFor } from '../utils/ingredients';
import { mealPlanLines, plannedMeals } from '../utils/smartShopping';

const TABS = [
  { id: 'plan', labelKey: 'food.tabWeekPlan' },
  { id: 'recipes', labelKey: 'food.tabRecipes' },
];

export default function FoodPage() {
  const { user, userDoc, family } = useAuth();
  const { t, locale } = useT();
  const familyId = userDoc?.familyId;
  const { setFoodFabCallback } = useOutletContext() || {};

  const members = useFamilyMembers();
  const cooks = family?.cooks ?? [];

  const { recipes, loading: recipesLoading } = useRecipes(familyId);
  const { entries, loading: entriesLoading } = useMealPlan(familyId);
  // Subscribed here rather than read inside the service, so the review modal
  // previews exactly the decisions the write will carry out.
  const { items: shoppingItems } = useShoppingItems(familyId);

  const [tab, setTab] = useState('plan');
  const [recipeModal, setRecipeModal] = useState(null); // null | { recipe } | {}
  const [viewRecipe, setViewRecipe] = useState(null); // recipe shown in detail view
  const [cookingRecipe, setCookingRecipe] = useState(null); // recipe in cooking mode
  const [planAddSignal, setPlanAddSignal] = useState(0);
  const [shopWeekStart, setShopWeekStart] = useState(null);

  // Keep the open detail view in sync with live recipe updates (e.g. after an
  // edit) so the latest ingredients/steps show without reopening.
  const viewRecipeLive = viewRecipe
    ? recipes.find((r) => r.id === viewRecipe.id) || viewRecipe
    : null;

  // Wire the shared "+" button to the active tab's add action.
  const handleAdd = useCallback(() => {
    if (tab === 'recipes') setRecipeModal({});
    else setPlanAddSignal((n) => n + 1);
  }, [tab]);

  useEffect(() => {
    setFoodFabCallback?.(() => handleAdd);
    return () => setFoodFabCallback?.(null);
  }, [setFoodFabCallback, handleAdd]);

  async function handleRecipeSubmit(values) {
    if (recipeModal?.recipe) {
      await updateRecipe(recipeModal.recipe.id, values);
    } else {
      await createRecipe({ familyId, userId: user.uid, ...values });
    }
    setRecipeModal(null);
  }

  async function handleRecipeDelete() {
    if (recipeModal?.recipe) await deleteRecipe(recipeModal.recipe.id);
    setRecipeModal(null);
  }

  async function handleMealSave({ date, slot, entry, recipeId, text, cookId, cookType, cookName }) {
    if (entry) {
      await updateMealEntry(entry.id, { recipeId, text, cookId, cookType, cookName });
    } else {
      await createMealEntry({
        familyId,
        userId: user.uid,
        date,
        slot,
        recipeId,
        text,
        cookId,
        cookType,
        cookName,
      });
    }
  }

  // Every ingredient planned for the seven days starting at shopWeekStart,
  // scaled from each recipe's servings to the household. Free-text entries
  // have no recipe and therefore no ingredients.
  const portions = householdPortions({
    household: family?.household,
    kids: family?.kids,
    memberCount: family?.memberIds?.length,
  }).total;
  const weekLines = useMemo(() => {
    if (!shopWeekStart) return [];
    const end = new Date(shopWeekStart);
    end.setDate(end.getDate() + 7);
    return mealPlanLines({
      entries,
      recipes,
      from: shopWeekStart,
      to: end,
      portions,
      decimalSeparator: decimalSeparatorFor(locale),
    }).map((l) => l.line);
  }, [shopWeekStart, entries, recipes, portions, locale]);

  async function handleAddIngredients(lines) {
    const plan = planShoppingAdditions({ lines, existingItems: shoppingItems });
    return addShoppingItemsBulk({ familyId, userId: user.uid, plan, items: shoppingItems });
  }

  // The week's meals count as shopped for afterwards, so the weekly proposal
  // on the shopping list does not offer the same meals a second time.
  async function handleConfirmWeek(plan) {
    const end = new Date(shopWeekStart);
    end.setDate(end.getDate() + 7);
    const meals = plannedMeals({ entries, recipes, from: shopWeekStart, to: end }).map((m) => m.entry);
    await Promise.all([
      addShoppingItemsBulk({ familyId, userId: user.uid, plan, items: shoppingItems }),
      markMealsShopped(meals),
    ]);
    setShopWeekStart(null);
  }

  // Add a new external cook to the family's cook list and return it so the
  // modal can immediately select it.
  function handleAddCook(name) {
    return addCook(familyId, name, cooks.length);
  }

  function handleRemoveCook(cook) {
    return removeCook(familyId, cook);
  }

  return (
    <>
      <TopBar title={t('food.title')} />
      <main className="mx-auto max-w-md space-y-5 px-5 py-5">
        <div className="flex rounded-xl bg-slate-100 p-1">
          {TABS.map((tabItem) => (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setTab(tabItem.id)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === tabItem.id ? 'bg-white text-brand-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              {t(tabItem.labelKey)}
            </button>
          ))}
        </div>

        {tab === 'plan' ? (
          <WeekMealPlan
            entries={entries}
            recipes={recipes}
            loading={entriesLoading || recipesLoading}
            onSave={handleMealSave}
            onDelete={deleteMealEntry}
            addSignal={planAddSignal}
            members={members}
            cooks={cooks}
            onAddCook={handleAddCook}
            onRemoveCook={handleRemoveCook}
            onViewRecipe={setViewRecipe}
            onShopWeek={setShopWeekStart}
          />
        ) : (
          <RecipeList
            recipes={recipes}
            loading={recipesLoading}
            onSelect={setViewRecipe}
          />
        )}
      </main>

      <RecipeDetailModal
        open={Boolean(viewRecipeLive)}
        onClose={() => setViewRecipe(null)}
        recipe={viewRecipeLive}
        onAddIngredients={handleAddIngredients}
        onEdit={() => {
          setRecipeModal({ recipe: viewRecipeLive });
          setViewRecipe(null);
        }}
        onStartCooking={() => {
          setCookingRecipe(viewRecipeLive);
          setViewRecipe(null);
        }}
      />

      <CookingMode
        open={Boolean(cookingRecipe)}
        onClose={() => setCookingRecipe(null)}
        recipe={cookingRecipe}
      />

      <WeekShoppingModal
        open={Boolean(shopWeekStart)}
        onClose={() => setShopWeekStart(null)}
        lines={weekLines}
        shoppingItems={shoppingItems}
        onConfirm={handleConfirmWeek}
      />

      <RecipeFormModal
        open={Boolean(recipeModal)}
        onClose={() => setRecipeModal(null)}
        onSubmit={handleRecipeSubmit}
        onDelete={recipeModal?.recipe ? handleRecipeDelete : undefined}
        initial={recipeModal?.recipe}
      />
    </>
  );
}
