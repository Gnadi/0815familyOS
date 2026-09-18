import { Calendar } from 'lucide-react';
import useT from '../../hooks/useT';
import useUIPreferences from '../../hooks/useUIPreferences';
import DayTimeline from './DayTimeline';
import EventCard from './EventCard';
import EmptyState from '../common/EmptyState';

// One day, as the week and month views both show it -- either as the list of
// cards or as the hour grid, never both. The switch sits in the calendar's top
// bar and is remembered across sessions.
export default function DayAgenda({ day, events, onEventClick, title }) {
  const { t } = useT();
  const { showDayTimeline } = useUIPreferences();

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
      ) : showDayTimeline ? (
        <div className={title ? 'mt-3' : ''}>
          <DayTimeline day={day} events={events} onEventClick={onEventClick} />
        </div>
      ) : (
        <div className={`space-y-3 ${title ? 'mt-3' : ''}`}>
          {events.map((ev) => (
            <EventCard key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
          ))}
        </div>
      )}
    </div>
  );
}
