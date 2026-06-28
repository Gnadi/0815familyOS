import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import WeekMealPlan from '../components/food/WeekMealPlan';
import RecipeList from '../components/food/RecipeList';
import RecipeFormModal from '../components/food/RecipeFormModal';
import useAuth from '../hooks/useAuth';
import useRecipes from '../hooks/useRecipes';
import useMealPlan from '../hooks/useMealPlan';
import { createRecipe, updateRecipe, deleteRecipe } from '../services/recipes';
import { createMealEntry, updateMealEntry, deleteMealEntry } from '../services/mealPlan';

const TABS = [
  { id: 'plan', label: 'Week Plan' },
  { id: 'recipes', label: 'Recipes' },
];

export default function FoodPage() {
  const { user, userDoc } = useAuth();
  const familyId = userDoc?.familyId;
  const { setFoodFabCallback } = useOutletContext() || {};

  const { recipes, loading: recipesLoading } = useRecipes(familyId);
  const { entries, loading: entriesLoading } = useMealPlan(familyId);

  const [tab, setTab] = useState('plan');
  const [recipeModal, setRecipeModal] = useState(null); // null | { recipe } | {}
  const [planAddSignal, setPlanAddSignal] = useState(0);

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

  async function handleMealSave({ date, slot, entry, recipeId, text }) {
    if (entry) {
      await updateMealEntry(entry.id, { recipeId, text });
    } else {
      await createMealEntry({ familyId, userId: user.uid, date, slot, recipeId, text });
    }
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
          />
        ) : (
          <RecipeList
            recipes={recipes}
            loading={recipesLoading}
            onSelect={(recipe) => setRecipeModal({ recipe })}
          />
        )}
      </main>

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
