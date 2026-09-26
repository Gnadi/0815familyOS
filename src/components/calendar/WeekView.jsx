import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addWeeks, format, isSameDay, subWeeks } from 'date-fns';
import {
  dayKey,
  formatWeekRange,
  getWeekDays,
  groupEventsByDay,
  NO_EVENTS,
  weekStart,
} from '../../utils/date';
import useCategories from '../../hooks/useCategories';
import useT from '../../hooks/useT';
import useSwipe from '../../hooks/useSwipe';
import DayAgenda from './DayAgenda';
import TodayButton from './TodayButton';

export default function WeekView({
  anchor,
  selected,
  onAnchorChange,
  onSelect,
  events,
  onEventClick,
  onCreateAt,
}) {
  const { get: getCat } = useCategories();
  const { t } = useT();
  const days = getWeekDays(anchor);
  // One pass over the events instead of one full scan per day cell.
  const byDay = useMemo(() => groupEventsByDay(events), [events]);
  const dayEvents = byDay.get(dayKey(selected)) || NO_EVENTS;
  const monthLabel = formatWeekRange(days);
  // Paging to another week always lands on its Monday, not on the weekday that
  // happened to be selected before.
  const goToWeek = (d) => onAnchorChange(weekStart(d));
  // Swiping left goes forward in time, as in every other calendar.
  const swipe = useSwipe({
    onLeft: () => goToWeek(addWeeks(anchor, 1)),
    onRight: () => goToWeek(subWeeks(anchor, 1)),
  });

  return (
    <div {...swipe}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <TodayButton selected={selected} onJump={onAnchorChange} />
          <button
            onClick={() => goToWeek(subWeeks(anchor, 1))}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label={t('calendar.prevWeek')}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => goToWeek(addWeeks(anchor, 1))}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label={t('calendar.nextWeek')}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 text-center text-xs font-medium text-slate-400">
        {days.map((d) => (
          <span key={d.toISOString()}>{format(d, 'EEEEE')}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((d) => {
          const active = isSameDay(d, selected);
          const dayEvs = byDay.get(dayKey(d)) || NO_EVENTS;
          const categories = [...new Set(dayEvs.map((e) => e.category))].slice(0, 3);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelect(d)}
              className={`flex flex-col items-center gap-1 rounded-full py-1.5 text-sm font-semibold transition ${
                active ? 'bg-brand-500 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{format(d, 'd')}</span>
              {categories.length > 0 && (
                <span className="flex h-1.5 items-center gap-0.5">
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

      <div className="mt-6">
        <DayAgenda
          day={selected}
          events={dayEvents}
          onEventClick={onEventClick}
          onCreateAt={onCreateAt}
        />
      </div>
    </div>
  );
}
