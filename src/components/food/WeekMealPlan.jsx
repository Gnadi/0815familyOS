import { useEffect, useMemo, useState } from 'react';
import { addDays, addWeeks, format, isSameDay, isToday, startOfWeek } from 'date-fns';
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink, Plus } from 'lucide-react';
import Spinner from '../common/Spinner';
import AvatarStack from '../common/AvatarStack';
import MealEntryModal from './MealEntryModal';
import { MEAL_SLOTS } from '../../constants/mealSlots';
import useT from '../../hooks/useT';
import { tLabel } from '../../i18n/labels';

// Normalise a user-entered recipe link into an openable absolute URL.
function recipeHref(url) {
  const trimmed = (url || '').trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default function WeekMealPlan({
  entries,
  recipes,
  loading,
  onSave,
  onDelete,
  addSignal,
  members = [],
  cooks = [],
  onAddCook,
  onRemoveCook,
  onViewRecipe,
}) {
  const { t } = useT();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [cell, setCell] = useState(null); // { date, slot }

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const recipeById = useMemo(
    () => Object.fromEntries(recipes.map((r) => [r.id, r])),
    [recipes],
  );

  const memberById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.uid, m])),
    [members],
  );

  // Resolve the cook's display name: live from the member list when it's a
  // family member, otherwise the snapshot stored on the entry (robust even if
  // an external cook was later removed from the family's cook list).
  function cookFor(entry) {
    if (!entry?.cookId) return null;
    const name =
      entry.cookType === 'member'
        ? memberById[entry.cookId]?.displayName || entry.cookName
        : entry.cookName;
    if (!name) return null;
    return { uid: entry.cookId, displayName: name };
  }

  // The page's FAB bumps `addSignal`; open "plan a meal" for today's dinner (or
  // the first day shown if the current week is in the past/future).
  useEffect(() => {
    if (!addSignal) return;
    const today = days.find((d) => isToday(d)) || days[0];
    setCell({ date: today, slot: 'dinner' });
    // Intentionally only react to the signal changing, not the derived days.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addSignal]);

  function entryFor(date, slot) {
    return entries.find((e) => e.date && isSameDay(e.date, date) && e.slot === slot) || null;
  }

  function labelFor(entry) {
    if (!entry) return null;
    if (entry.recipeId) return recipeById[entry.recipeId]?.title || t('food.recipeDeleted');
    return entry.text;
  }

  const current = cell ? entryFor(cell.date, cell.slot) : null;

  async function handleSubmit(values) {
    await onSave({ ...cell, entry: current, ...values });
    setCell(null);
  }

  async function handleDelete() {
    if (current) await onDelete(current.id);
    setCell(null);
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2.5 shadow-card">
        <button
          type="button"
          onClick={() => setWeekStart((w) => addWeeks(w, -1))}
          aria-label={t('calendar.prevWeek')}
          className="rounded-full p-2.5 text-slate-500 transition hover:bg-slate-100 active:scale-95"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="text-center">
          <p className="text-lg font-bold tracking-tight text-slate-900">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d')}
          </p>
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="text-sm font-semibold text-brand-600 hover:underline"
          >
            {t('food.jumpToToday')}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setWeekStart((w) => addWeeks(w, 1))}
          aria-label={t('calendar.nextWeek')}
          className="rounded-full p-2.5 text-slate-500 transition hover:bg-slate-100 active:scale-95"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      <div className="space-y-4">
        {days.map((day) => {
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={`overflow-hidden rounded-3xl bg-white shadow-card ${
                today ? 'ring-2 ring-brand-300' : ''
              }`}
            >
              <div
                className={`flex items-center justify-between px-5 py-3.5 ${
                  today ? 'bg-brand-50' : 'bg-slate-50/60'
                }`}
              >
                <h3
                  className={`text-lg font-bold tracking-tight ${
                    today ? 'text-brand-700' : 'text-slate-900'
                  }`}
                >
                  {format(day, 'EEEE')}
                </h3>
                <span
                  className={`text-sm font-semibold ${today ? 'text-brand-600' : 'text-slate-400'}`}
                >
                  {today ? t('common.today') : format(day, 'MMM d')}
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {MEAL_SLOTS.map((slot) => {
                  const entry = entryFor(day, slot.id);
                  const recipe = entry?.recipeId ? recipeById[entry.recipeId] : null;
                  const label = labelFor(entry);
                  const cook = cookFor(entry);
                  const href = recipe ? recipeHref(recipe.sourceUrl) : null;
                  return (
                    <div key={slot.id} className="flex items-center gap-3 px-5">
                      <button
                        type="button"
                        onClick={() => setCell({ date: day, slot: slot.id })}
                        className="flex min-w-0 flex-1 items-center gap-4 py-4 text-left"
                      >
                        <span className="w-20 shrink-0 text-xs font-bold uppercase tracking-wider text-slate-400">
                          {tLabel(t, slot)}
                        </span>
                        {label ? (
                          <span className="min-w-0 flex-1 truncate text-base font-medium text-slate-900">
                            {label}
                          </span>
                        ) : (
                          <span className="flex min-w-0 flex-1 items-center gap-1.5 text-base text-slate-300">
                            <Plus size={18} /> {t('food.addMeal')}
                          </span>
                        )}
                        {cook && <AvatarStack members={[cook]} max={1} size="md" />}
                      </button>
                      {recipe &&
                        (href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={t('food.openRecipeLinkFor', { meal: label })}
                            className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600"
                          >
                            <ExternalLink size={18} />
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewRecipe?.(recipe);
                            }}
                            aria-label={t('food.viewRecipe', { meal: label })}
                            className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600"
                          >
                            <BookOpen size={18} />
                          </button>
                        ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <MealEntryModal
        open={Boolean(cell)}
        onClose={() => setCell(null)}
        onSubmit={handleSubmit}
        onDelete={current ? handleDelete : undefined}
        cell={cell}
        entry={current}
        recipes={recipes}
        members={members}
        cooks={cooks}
        onAddCook={onAddCook}
        onRemoveCook={onRemoveCook}
      />
    </div>
  );
}
