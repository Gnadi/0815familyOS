import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ShoppingBasket } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import useT from '../../hooks/useT';
import { MIN_RECIPES_TO_SUGGEST } from '../../utils/mealSuggestions';
import { rhythmText } from './rhythmText';
import WeekMenu from './WeekMenu';

// Review step for the weekly shop, in two parts: the meals for the week (see
// WeekMenu), then everything the shop should buy — what the rhythm says runs
// out before the shop after this one, plus what the week's meals need (see
// planWeeklyProposal). Like WeekShoppingModal it never writes silently — what
// is already on the list comes unchecked and labelled, the rest pre-checked.
//
// Ingredients only ever come from the meals of this week, each meal only once.
// Nothing is invented from past weeks: families do not eat the same every week.
export default function WeeklyProposalModal({ open, onClose, title, plan, menu, recipeCount = 0, onConfirm }) {
  const { t, tn } = useT();
  // What the family unticked. Everything else is ticked, so ingredients of a
  // meal chosen while the sheet is open arrive ticked like the rest.
  const [deselected, setDeselected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDeselected(new Set());
    setError('');
  }, [open]);

  const selectable = plan.filter((p) => p.action !== 'skip');
  const chosen = selectable.filter((p) => !deselected.has(p.key));
  const allSelected = selectable.length > 0 && chosen.length === selectable.length;
  const newMeals = menu.picks.length;

  function toggle(key) {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setDeselected(allSelected ? new Set(selectable.map((p) => p.key)) : new Set());
  }

  async function handleConfirm() {
    setError('');
    setBusy(true);
    try {
      await onConfirm(chosen);
    } catch (err) {
      setError(err.message || t('food.errAddToShopping'));
    } finally {
      setBusy(false);
    }
  }

  function reasonText(entry) {
    const parts = [];
    if (entry.reasons.includes('due')) {
      const rhythm = rhythmText({ intervalDays: entry.intervalDays }, { t, tn });
      parts.push(rhythm ? `${t('shopping.reasonDue')} · ${rhythm}` : t('shopping.reasonDue'));
    }
    if (entry.sources.length > 0) {
      parts.push(t('shopping.reasonRecipe', { recipes: entry.sources.join(', ') }));
    }
    return parts.join(' · ');
  }

  let confirmLabel = tn('food.addNItems', chosen.length);
  if (chosen.length === 0 && newMeals > 0) confirmLabel = tn('shopping.planNMeals', newMeals);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-6">
        <WeekMenu {...menu} />

        <section className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShoppingBasket size={16} className="text-brand-500" /> {t('shopping.proposalListTitle')}
              </h3>
              <p className="mt-1 text-xs text-slate-500">{t('shopping.proposalSubtitle')}</p>
            </div>
            {selectable.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="shrink-0 text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                {allSelected ? t('food.selectNone') : t('food.selectAll')}
              </button>
            )}
          </div>

          {plan.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
              {t('shopping.proposalEmpty')}
            </p>
          ) : (
            <ul className="rounded-xl border border-slate-200">
              {plan.map((entry) => {
                const already = entry.action === 'skip';
                const reason = reasonText(entry);
                return (
                  <li key={entry.key} className="border-t border-slate-100 first:border-t-0">
                    <label className={`flex items-center gap-3 px-3 py-2.5 ${already ? 'opacity-60' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={!already && !deselected.has(entry.key)}
                        onChange={() => toggle(entry.key)}
                        disabled={already}
                        className="h-5 w-5 shrink-0 rounded-sm border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">
                          {entry.title}
                          {entry.quantity && (
                            <span className="ml-1.5 text-xs font-normal text-slate-500">{entry.quantity}</span>
                          )}
                        </span>
                        {reason && (
                          <span
                            className={`block truncate text-xs ${
                              entry.reasons.includes('due') ? 'text-amber-600' : 'text-slate-500'
                            }`}
                          >
                            {reason}
                          </span>
                        )}
                      </span>
                      {already && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                          {t('shopping.alreadyOnList')}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {recipeCount < MIN_RECIPES_TO_SUGGEST && (
          <div className="flex gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <BookOpen size={16} className="shrink-0 text-brand-500" />
            <span>
              {recipeCount === 0 ? t('shopping.noRecipes') : tn('shopping.fewRecipes', recipeCount)}{' '}
              <Link to="/meals" className="font-semibold text-brand-600 hover:underline">
                {t('shopping.toRecipes')}
              </Link>
            </span>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button
          onClick={handleConfirm}
          loading={busy}
          disabled={chosen.length === 0 && newMeals === 0}
          className="w-full"
        >
          <ShoppingBasket size={16} />
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
