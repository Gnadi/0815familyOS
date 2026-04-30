import { isSameDay } from 'date-fns';
import { computeCapacityLoad, currentSprintMonday } from '../../utils/tasks';

const BUBBLE_BY_LEVEL = {
  none: 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400',
  low:  'bg-emerald-100 text-emerald-700',
  mid:  'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

export default function CapacityHeatmap({ tasks }) {
  const monday = currentSprintMonday();
  const capacity = computeCapacityLoad(tasks, monday);
  const today = new Date();

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card dark:bg-slate-800">
      <h2 className="text-base font-bold text-slate-900 dark:text-white">Household Capacity Heatmap</h2>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {capacity.map((day) => {
          const isToday = isSameDay(day.date, today);
          const bubble = BUBBLE_BY_LEVEL[day.level] || BUBBLE_BY_LEVEL.none;
          return (
            <div key={day.label} className="flex flex-col items-center gap-1.5">
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  isToday ? 'text-brand-600' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {day.label}
              </span>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold tabular-nums ${bubble} ${
                  isToday ? 'ring-2 ring-brand-500 ring-offset-1' : ''
                }`}
              >
                {day.points}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
