import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarPlus, CheckCircle2, ShoppingBasket } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import useT from '../../hooks/useT';
import { formatRelativeDay } from '../../utils/date';
import { rhythmText } from './rhythmText';

// Below this many recipes a week of dinners cannot be planned without
// repeating, so the proposal suggests adding more.
export const FEW_RECIPES = 7;

// Review step for the weekly shop: everything the rhythm says runs out before
// the shop after this one, plus what the planned meals need (see
// planWeeklyProposal). Like WeekShoppingModal it never writes silently — what
// is already on the list comes unchecked and labelled, the rest pre-checked.
//
// Ingredients only ever come from meals the family planned for that week, and
// each meal only once (`meals` says which were already shopped for). Nothing
// is invented from past weeks: families do not eat the same every week.
export default function WeeklyProposalModal({ open, onClose, title, plan, meals = [], recipeCount = 0, onConfirm }) {
  const { t, tn } = useT();
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Only when the sheet opens: the plan is live, and re-selecting on every
  // snapshot would undo the family's unticking while they read.
  useEffect(() => {
    if (!open) return;
    setSelected(new Set(plan.filter((p) => p.action !== 'skip').map((p) => p.key)));
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectable = plan.filter((p) => p.action !== 'skip');
  const allSelected = selectable.length > 0 && selectable.every((p) => selected.has(p.key));
  const chosen = selectable.filter((p) => selected.has(p.key));

  function toggle(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable.map((p) => p.key)));
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

  const shoppedMeals = meals.filter((m) => m.shopped);
  const mealName = ({ entry, recipe }) => `${recipe.title} (${formatRelativeDay(entry.date, t)})`;

  // What the family can do to get a fuller proposal, and what was already
  // taken care of — so a short proposal never looks like a broken one.
  const hints = (
    <div className="space-y-2">
      {shoppedMeals.length > 0 && (
        <p className="flex gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
          <span>{t('shopping.mealsShopped', { meals: shoppedMeals.map(mealName).join(', ') })}</span>
        </p>
      )}
      {meals.length === 0 && (
        <div className="flex gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          <CalendarPlus size={16} className="shrink-0 text-brand-500" />
          <span>
            {t('shopping.noMealsPlanned')}{' '}
            <Link to="/meals" className="font-semibold text-brand-600 hover:underline">
              {t('shopping.toWeekPlan')}
            </Link>
          </span>
        </div>
      )}
      {recipeCount < FEW_RECIPES && (
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
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {plan.length === 0 ? (
        <div className="space-y-4">
          <p className="py-4 text-center text-sm text-slate-400">{t('shopping.proposalEmpty')}</p>
          {hints}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-slate-500">{t('shopping.proposalSubtitle')}</p>
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

          <ul className="rounded-xl border border-slate-200">
            {plan.map((entry) => {
              const already = entry.action === 'skip';
              const reason = reasonText(entry);
              return (
                <li key={entry.key} className="border-t border-slate-100 first:border-t-0">
                  <label className={`flex items-center gap-3 px-3 py-2.5 ${already ? 'opacity-60' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={!already && selected.has(entry.key)}
                      onChange={() => toggle(entry.key)}
                      disabled={already}
                      className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
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

          {hints}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleConfirm} loading={busy} disabled={chosen.length === 0} className="w-full">
            <ShoppingBasket size={16} />
            {tn('food.addNItems', chosen.length)}
          </Button>
        </div>
      )}
    </Modal>
  );
}
