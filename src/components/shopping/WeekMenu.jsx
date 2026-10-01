import { useState } from 'react';
import { CalendarCheck, ChefHat, Minus, Plus, RefreshCw, Sparkles, X } from 'lucide-react';
import useT from '../../hooks/useT';
import { formatRelativeDay } from '../../utils/date';
import { daysBetween } from '../../utils/consumption';

// "Meals this week" at the top of the weekly proposal: how many meals the
// family wants to cook this week (asked anew every week), what is already in
// the week plan, and the rest filled from the family's own recipes — each
// suggestion swappable or removable, any recipe pickable by hand.
export default function WeekMenu({
  meals,
  picks,
  count,
  canSuggest,
  candidates,
  onCount,
  onSwap,
  onRemove,
  onSuggest,
  onPick,
  maxCount,
}) {
  const { t, tn } = useT();
  const [choosing, setChoosing] = useState(false);
  const free = Math.max(0, count - meals.length - picks.length);

  function lastPlannedText({ lastPlanned, recent }) {
    if (recent) return t('shopping.plannedRecently');
    if (!lastPlanned) return t('shopping.plannedNever');
    const days = daysBetween(lastPlanned, new Date());
    return days >= 14
      ? t('shopping.plannedWeeksAgo', { count: Math.floor(days / 7) })
      : t('shopping.plannedDaysAgo', { count: days });
  }

  function choose(row) {
    onPick(row.recipe);
    setChoosing(false);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ChefHat size={16} className="text-brand-500" /> {t('shopping.menuTitle')}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCount(count - 1)}
            disabled={count <= meals.length}
            aria-label={t('shopping.menuFewer')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
          >
            <Minus size={16} />
          </button>
          <span className="w-6 text-center text-base font-semibold text-slate-900" aria-live="polite">
            {count}
          </span>
          <button
            type="button"
            onClick={() => onCount(count + 1)}
            disabled={count >= maxCount}
            aria-label={t('shopping.menuMore')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
      <p className="-mt-1 text-xs text-slate-500">{t('shopping.menuQuestion')}</p>

      {(meals.length > 0 || picks.length > 0) && (
        <ul className="rounded-xl border border-slate-200">
          {meals.map(({ entry, recipe, shopped }) => (
            <li key={entry.id} className="flex items-center gap-3 border-t border-slate-100 px-3 py-2.5 first:border-t-0">
              <CalendarCheck size={18} className="shrink-0 text-emerald-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">{recipe.title}</span>
                <span className="block truncate text-xs text-slate-500">
                  {t('shopping.menuPlanned', { day: formatRelativeDay(entry.date, t) })}
                  {shopped && ` · ${t('shopping.menuShopped')}`}
                </span>
              </span>
            </li>
          ))}
          {picks.map((row, i) => (
            <li key={row.recipe.id} className="flex items-center gap-3 border-t border-slate-100 py-2 pl-3 pr-1.5 first:border-t-0">
              <Sparkles size={18} className="shrink-0 text-brand-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">{row.recipe.title}</span>
                <span className="block truncate text-xs text-slate-500">
                  {row.manual ? t('shopping.menuChosen') : t('shopping.menuSuggested')} · {lastPlannedText(row)}
                </span>
              </span>
              {canSuggest && !row.manual && candidates.length > 0 && (
                <button
                  type="button"
                  onClick={() => onSwap(i)}
                  aria-label={t('shopping.menuSwap', { name: row.recipe.title })}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                >
                  <RefreshCw size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={t('shopping.menuRemove', { name: row.recipe.title })}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {free > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-200 p-3">
          <span className="mr-auto text-sm text-slate-600">{tn('shopping.menuFree', free)}</span>
          {canSuggest && candidates.length > 0 && (
            <button
              type="button"
              onClick={onSuggest}
              className="rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
            >
              {t('shopping.menuSuggest')}
            </button>
          )}
        </div>
      )}

      {candidates.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setChoosing((v) => !v)}
            aria-expanded={choosing}
            className="text-sm font-semibold text-brand-600 hover:underline"
          >
            {t('shopping.menuChoose')}
          </button>
          {choosing && (
            <ul className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200">
              {candidates.map((row) => (
                <li key={row.recipe.id} className="border-t border-slate-100 first:border-t-0">
                  <button
                    type="button"
                    onClick={() => choose(row)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                  >
                    <Plus size={16} className="shrink-0 text-brand-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{row.recipe.title}</span>
                      <span className="block truncate text-xs text-slate-500">{lastPlannedText(row)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {picks.length > 0 && <p className="text-xs text-slate-500">{t('shopping.menuPlacement')}</p>}
    </section>
  );
}
