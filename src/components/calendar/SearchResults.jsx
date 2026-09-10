import { useMemo } from 'react';
import { format, isSameDay, isToday } from 'date-fns';
import { AlertTriangle, SearchX } from 'lucide-react';
import EventCard from './EventCard';
import EmptyState from '../common/EmptyState';
import useT from '../../hooks/useT';
import { dayKey } from '../../utils/date';

// Results span arbitrary days, so they carry their own date headers instead of
// the single selected day the week and month views show.
function groupByDay(events) {
  const groups = [];
  let current = null;
  for (const ev of events) {
    const key = dayKey(ev.date);
    if (!current || current.key !== key) {
      current = { key, date: ev.date, events: [] };
      groups.push(current);
    }
    current.events.push(ev);
  }
  return groups;
}

function DayGroup({ group, onEventClick }) {
  const { t } = useT();
  const today = isToday(group.date);
  const tomorrow = isSameDay(group.date, new Date(Date.now() + 24 * 60 * 60 * 1000));
  const weekday = today
    ? t('common.today')
    : tomorrow
    ? t('common.tomorrow')
    : format(group.date, 'EEEE');

  return (
    <div className="space-y-3">
      <h4 className="flex items-baseline gap-2 text-sm font-semibold text-slate-900">
        {weekday}
        <span className="text-xs font-normal text-slate-400">{format(group.date, 'PPP')}</span>
      </h4>
      {group.events.map((ev) => (
        <EventCard key={ev.id} event={ev} onClick={() => onEventClick(ev)} showSource />
      ))}
    </div>
  );
}

export default function SearchResults({ query, results, feedErrors, onEventClick }) {
  const { t, tn } = useT();
  const upcomingGroups = useMemo(() => groupByDay(results.upcoming), [results.upcoming]);
  const pastGroups = useMemo(() => groupByDay(results.past), [results.past]);

  // A subscribed calendar that failed to load is served from its cache or not
  // at all, so the result list may be missing events the user knows exist.
  // Saying so beats letting them conclude the search is broken.
  const feedWarning = feedErrors?.length ? (
    <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
      {t('calendar.searchFeedWarning')}
    </p>
  ) : null;

  if (results.total === 0) {
    return (
      <div className="space-y-3">
        {feedWarning}
        <EmptyState
          icon={SearchX}
          title={t('calendar.noSearchResults', { query })}
          description={t('calendar.noSearchResultsDesc')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-slate-500">{tn('calendar.searchResults', results.total)}</p>
        {results.truncated && (
          <p className="text-xs text-slate-400">
            {t('calendar.searchTruncated', {
              count: results.upcoming.length + results.past.length,
            })}
          </p>
        )}
      </div>

      {feedWarning}

      {upcomingGroups.map((group) => (
        <DayGroup key={group.key} group={group} onEventClick={onEventClick} />
      ))}

      {pastGroups.length > 0 && (
        <div className="space-y-5">
          <h3 className="border-t border-slate-200 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('calendar.searchEarlier')}
          </h3>
          {pastGroups.map((group) => (
            <DayGroup key={group.key} group={group} onEventClick={onEventClick} />
          ))}
        </div>
      )}
    </div>
  );
}
