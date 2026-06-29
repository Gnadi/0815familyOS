import { ExternalLink, Link2 } from 'lucide-react';
import { getRecipeCategory } from '../../constants/recipeCategories';
import useT from '../../hooks/useT';
import { tLabel } from '../../i18n/labels';

export default function RecipeCard({ recipe, onClick }) {
  const { t } = useT();
  const cat = getRecipeCategory(recipe.category);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-2xl bg-white p-4 text-left shadow-card active:opacity-70"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-slate-900">{recipe.title}</h3>
          {recipe.sourceUrl && <Link2 size={14} className="shrink-0 text-slate-400" />}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cat.chipBg} ${cat.chipText}`}>
            {tLabel(t, cat)}
          </span>
          {recipe.ingredients.length > 0 && (
            <span className="truncate text-xs text-slate-400">
              {recipe.ingredients[0]}
            </span>
          )}
        </div>
      </div>
      {recipe.sourceUrl && (
        <a
          href={recipe.sourceUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label={t('food.openRecipeLink')}
          className="shrink-0 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
        >
          <ExternalLink size={16} />
        </a>
      )}
    </button>
  );
}
