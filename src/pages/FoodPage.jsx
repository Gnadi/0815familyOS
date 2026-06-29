import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import WeekMealPlan from '../components/food/WeekMealPlan';
import RecipeList from '../components/food/RecipeList';
import RecipeFormModal from '../components/food/RecipeFormModal';
import RecipeDetailModal from '../components/food/RecipeDetailModal';
import CookingMode from '../components/food/CookingMode';
import useAuth from '../hooks/useAuth';
import useFamilyMembers from '../hooks/useFamilyMembers';
import useRecipes from '../hooks/useRecipes';
import useMealPlan from '../hooks/useMealPlan';
import { createRecipe, updateRecipe, deleteRecipe } from '../services/recipes';
import { createMealEntry, updateMealEntry, deleteMealEntry } from '../services/mealPlan';
import { addCook, removeCook } from '../services/families';

const TABS = [
  { id: 'plan', label: 'Week Plan' },
  { id: 'recipes', label: 'Recipes' },
];

export default function FoodPage() {
  const { user, userDoc, family } = useAuth();
  const familyId = userDoc?.familyId;
  const { setFoodFabCallback } = useOutletContext() || {};

  const members = useFamilyMembers();
  const cooks = family?.cooks ?? [];

  const { recipes, loading: recipesLoading } = useRecipes(familyId);
  const { entries, loading: entriesLoading } = useMealPlan(familyId);

  const [tab, setTab] = useState('plan');
  const [recipeModal, setRecipeModal] = useState(null); // null | { recipe } | {}
  const [viewRecipe, setViewRecipe] = useState(null); // recipe shown in detail view
  const [cookingRecipe, setCookingRecipe] = useState(null); // recipe in cooking mode
  const [planAddSignal, setPlanAddSignal] = useState(0);

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
      <TopBar title="Meals" showBell={false} />
      <main className="mx-auto max-w-md space-y-5 px-5 py-5">
        <div className="flex rounded-xl bg-slate-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === t.id ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              {t.label}
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
