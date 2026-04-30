import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, isSameDay, isSameMonth } from 'date-fns';
import { addMonths, getMonthGrid, subMonths, eventsOnDay } from '../../utils/date';
import useCategories from '../../hooks/useCategories';
import EventCard from './EventCard';
import EmptyState from '../common/EmptyState';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function MonthView({ anchor, selected, onAnchorChange, onSelect, events, onEventClick }) {
  const { get: getCat } = useCategories();
  const grid = getMonthGrid(anchor);
  const dayEvents = eventsOnDay(events, selected);

  return (
    <div>
      <div className="rounded-2xl bg-white p-4 shadow-card dark:bg-slate-800">
        <div className="flex items-center justify-between">
          <button
            onClick={() => onAnchorChange(subMonths(anchor, 1))}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {format(anchor, 'MMMM yyyy')}
          </h3>
          <button
            onClick={() => onAnchorChange(addMonths(anchor, 1))}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
          {DOW.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {grid.map((d) => {
            const active = isSameDay(d, selected);
            const inMonth = isSameMonth(d, anchor);
            const dayEvs = events.filter((e) => isSameDay(e.date, d));
            const categories = [...new Set(dayEvs.map((e) => e.category))].slice(0, 3);
            return (
              <button
                key={d.toISOString()}
                onClick={() => onSelect(d)}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition ${
                  active
                    ? 'bg-brand-500 text-white shadow-sm'
                    : inMonth
                    ? 'text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-700'
                    : 'text-slate-300 dark:text-slate-600'
                }`}
              >
                <span className={active ? 'font-bold' : 'font-medium'}>{format(d, 'd')}</span>
                {categories.length > 0 && (
                  <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                    {categories.map((c) => (
                      <span
                        key={c}
                        className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white' : getCat(c).dot}`}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          Events on {format(selected, 'MMMM d')}
        </h3>
        <div className="mt-3 space-y-3">
          {dayEvents.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No events for this day"
              description="Tap the + button to add one."
            />
          ) : (
            dayEvents.map((ev) => (
              <EventCard key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
