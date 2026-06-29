import { ChefHat, ExternalLink, Pencil } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { getRecipeCategory } from '../../constants/recipeCategories';
import useT from '../../hooks/useT';
import { tLabel } from '../../i18n/labels';

function recipeHref(url) {
  const trimmed = (url || '').trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// Read-only view of a recipe — the jumping-off point for editing or starting
// fullscreen cooking mode.
export default function RecipeDetailModal({ open, onClose, recipe, onEdit, onStartCooking }) {
  const { t } = useT();
  if (!recipe) return null;

  const cat = getRecipeCategory(recipe.category);
  const href = recipeHref(recipe.sourceUrl);
  const ingredients = recipe.ingredients || [];
  const steps = recipe.instructions || [];

  const footer = (
    <div className="flex gap-2">
      <Button type="button" variant="secondary" onClick={onEdit} className="flex-1">
        <Pencil size={16} /> {t('common.edit')}
      </Button>
      <Button
        type="button"
        onClick={onStartCooking}
        disabled={steps.length === 0}
        className="flex-1"
      >
        <ChefHat size={18} /> {t('food.startCooking')}
      </Button>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={recipe.title} footer={footer}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cat.chipBg} ${cat.chipText}`}>
            {tLabel(t, cat)}
          </span>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
            >
              <ExternalLink size={14} /> {t('food.openLink')}
            </a>
          )}
        </div>

        {ingredients.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-400">
              {t('food.ingredients')}
            </h3>
            <ul className="space-y-1.5">
              {ingredients.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-base text-slate-900">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {steps.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-400">
              {t('food.steps')}
            </h3>
            <ol className="space-y-3">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">
                    {i + 1}
                  </span>
                  <p className="text-base leading-relaxed text-slate-900">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {recipe.notes && (
          <div>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-400">
              {t('food.notes')}
            </h3>
            <p className="whitespace-pre-line text-base leading-relaxed text-slate-600">
              {recipe.notes}
            </p>
          </div>
        )}

        {ingredients.length === 0 && steps.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
            {t('food.noIngredientsSteps')}
          </p>
        )}
      </div>
    </Modal>
  );
}
