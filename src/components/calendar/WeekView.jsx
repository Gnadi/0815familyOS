import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { addWeeks, format, isSameDay, subWeeks } from 'date-fns';
import { getWeekDays, eventsOnDay } from '../../utils/date';
import useCategories from '../../hooks/useCategories';
import useT from '../../hooks/useT';
import EventCard from './EventCard';
import EmptyState from '../common/EmptyState';

export default function WeekView({ anchor, selected, onAnchorChange, onSelect, events, onEventClick }) {
  const { get: getCat } = useCategories();
  const { t } = useT();
  const days = getWeekDays(anchor);
  const dayEvents = eventsOnDay(events, selected);
  const monthLabel = format(anchor, 'MMMM yyyy');

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{monthLabel}</h3>
        <div className="flex gap-1">
          <button
            onClick={() => onAnchorChange(subWeeks(anchor, 1))}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label={t('calendar.prevWeek')}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => onAnchorChange(addWeeks(anchor, 1))}
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
          const dayEvs = events.filter((e) => isSameDay(e.date, d));
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

      <div className="mt-6 space-y-3">
        {dayEvents.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={t('calendar.noEventsDay')}
            description={t('calendar.noEventsDayDesc')}
          />
        ) : (
          dayEvents.map((ev) => (
            <EventCard key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
          ))
        )}
      </div>
    </div>
  );
}
