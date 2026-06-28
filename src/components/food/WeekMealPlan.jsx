import { useEffect, useMemo, useState } from 'react';
import { addDays, addWeeks, format, isSameDay, isToday, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import Spinner from '../common/Spinner';
import MealEntryModal from './MealEntryModal';
import { MEAL_SLOTS, getSlotLabel } from '../../constants/mealSlots';

export default function WeekMealPlan({ entries, recipes, loading, onSave, onDelete, addSignal }) {
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
    if (entry.recipeId) return recipeById[entry.recipeId]?.title || 'Recipe (deleted)';
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setWeekStart((w) => addWeeks(w, -1))}
          aria-label="Previous week"
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-900">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d')}
          </p>
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Today
          </button>
        </div>
        <button
          type="button"
          onClick={() => setWeekStart((w) => addWeeks(w, 1))}
          aria-label="Next week"
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="space-y-3">
        {days.map((day) => {
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={`rounded-2xl bg-white p-4 shadow-card ${today ? 'ring-2 ring-brand-200' : ''}`}
            >
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className={`text-sm font-semibold ${today ? 'text-brand-600' : 'text-slate-900'}`}>
                  {format(day, 'EEEE')}
                </h3>
                <span className="text-xs text-slate-400">{format(day, 'MMM d')}</span>
              </div>
              <div className="space-y-1.5">
                {MEAL_SLOTS.map((slot) => {
                  const entry = entryFor(day, slot.id);
                  const label = labelFor(entry);
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setCell({ date: day, slot: slot.id })}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-slate-50"
                    >
                      <span className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">
                        {slot.label}
                      </span>
                      {label ? (
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{label}</span>
                      ) : (
                        <span className="flex min-w-0 flex-1 items-center gap-1 text-sm text-slate-300">
                          <Plus size={14} /> Add
                        </span>
                      )}
                    </button>
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
      />
    </div>
  );
}
