import { Calendar, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import useT from '../../hooks/useT';
import useUIPreferences from '../../hooks/useUIPreferences';
import DayTimeline from './DayTimeline';
import EventCard from './EventCard';
import EmptyState from '../common/EmptyState';

// One day, as the week and month views both show it: the hour grid (optional,
// and remembered once switched on) above the list of cards.
export default function DayAgenda({ day, events, onEventClick, title }) {
  const { t } = useT();
  const { showDayTimeline, setShowDayTimeline } = useUIPreferences();

  return (
    <div>
      {title && <h3 className="text-base font-semibold text-slate-900">{title}</h3>}
      {events.length === 0 ? (
        <div className={title ? 'mt-3' : ''}>
          <EmptyState
            icon={Calendar}
            title={t('calendar.noEventsDay')}
            description={t('calendar.noEventsDayDesc')}
          />
        </div>
      ) : (
        <div className={`space-y-3 ${title ? 'mt-3' : ''}`}>
          <button
            onClick={() => setShowDayTimeline(!showDayTimeline)}
            aria-expanded={showDayTimeline}
            className="flex w-full items-center gap-2 rounded-xl px-1 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            <Clock size={14} className="flex-shrink-0" />
            <span className="flex-1 text-left">{t('calendar.dayTimeline')}</span>
            {showDayTimeline ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showDayTimeline && (
            <DayTimeline day={day} events={events} onEventClick={onEventClick} />
          )}

          {events.map((ev) => (
            <EventCard key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
          ))}
        </div>
      )}
    </div>
  );
}
