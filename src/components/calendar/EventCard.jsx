import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarSync, ChevronDown, ChevronUp, Clock, ExternalLink, MapPin, Repeat, User } from 'lucide-react';
import useCategories from '../../hooks/useCategories';
import useAuth from '../../hooks/useAuth';
import useT from '../../hooks/useT';
import { tLabel } from '../../i18n/labels';
import {
  eventDayCount,
  eventDayIndex,
  eventDays,
  eventEnd,
  formatEventEnd,
  formatDuration,
  isAllDay,
} from '../../utils/eventTime';
import { formatDate } from '../../utils/date';
import { describeRecurrence } from '../../utils/recurrence';

const EFFORT = {
  low:    { bar: 'bg-green-400',  badge: 'text-green-700 bg-green-100',   labelKey: 'calendar.effortLow' },
  medium: { bar: 'bg-amber-400',  badge: 'text-amber-700 bg-amber-100',   labelKey: 'calendar.effortMed' },
  high:   { bar: 'bg-rose-400',   badge: 'text-rose-700 bg-rose-100',     labelKey: 'calendar.effortHigh' },
};

const KID_CHIP = {
  violet: 'bg-violet-100 text-violet-700',
  sky:    'bg-sky-100 text-sky-700',
  pink:   'bg-pink-100 text-pink-700',
  teal:   'bg-teal-100 text-teal-700',
  orange: 'bg-orange-100 text-orange-700',
  indigo: 'bg-indigo-100 text-indigo-700',
};

function DetailRow({ icon: Icon, children }) {
  return (
    <div className="flex items-start gap-2 text-sm text-slate-600">
      <Icon size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

// `showSource` names the subscribed calendar an event came from. The week and
// month views show one day at a time, where the little external-link icon is
// context enough; search results mix calendars, so there the source is spelled
// out.
//
// `day` is the day the card is shown under. It only matters for an event that
// runs over several days, whose card then says which day of the run this is.
export default function EventCard({ event, onClick, showSource = false, day = null }) {
  const { get } = useCategories();
  const { family } = useAuth();
  const { t, tn } = useT();
  const cat = get(event.category);
  const [open, setOpen] = useState(false);

  const effort = event.effortLevel ? EFFORT[event.effortLevel] : null;
  const barClass = effort ? effort.bar : cat.bar;

  const isSynced = event.source === 'subscription';
  const sourceLabel = event.subscriptionLabel
    ? t('calendar.syncedFromCalendar', { name: event.subscriptionLabel })
    : t('calendar.syncedFromExternal');

  // Calendars ship DTEND with their events; the time column shows it under the
  // start instead of the AM/PM marker, which said nothing the 24h start time
  // did not already say.
  const endsAt = eventEnd(event);
  const endLabel = formatEventEnd(event);
  const repeats = describeRecurrence(event.recurrence, t, tn);

  const allDay = isAllDay(event);
  const spanDays = eventDayCount(event);
  const dayIndex = day && spanDays > 1 ? eventDayIndex(event, day) : 0;
  const span = spanDays > 1 ? eventDays(event) : null;

  // The time column. A one-day appointment shows its start and end; an all-day
  // one says so instead of a made-up clock time; and a run over several days
  // says which of its days this is, with the start only on the first and the
  // end only on the last.
  let timeTop;
  let timeBottom;
  if (allDay) {
    timeTop = t('calendar.allDay');
    timeBottom = dayIndex ? t('calendar.dayOfSpan', { i: dayIndex, n: spanDays }) : '';
  } else if (dayIndex > 1) {
    timeTop = dayIndex === spanDays
      ? t('calendar.untilTime', { time: format(endsAt, 'HH:mm') })
      : t('calendar.allDay');
    timeBottom = t('calendar.dayOfSpan', { i: dayIndex, n: spanDays });
  } else {
    timeTop = format(event.date, 'HH:mm');
    timeBottom = endLabel ? `– ${endLabel}` : format(event.date, 'a');
  }

  // What the card cannot show without being opened: the place, the full notes
  // (the card truncates them to two lines), how long it runs, whether it
  // repeats and which calendar it came from.
  const hasDetails = Boolean(
    event.location || endsAt || span || repeats || event.description || (isSynced && !showSource),
  );

  const familyKids = family?.kids || [];
  const eventKids = (event.kids || [])
    .map((id) => familyKids.find((k) => k.id === id))
    .filter(Boolean);

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card">
      <button
        onClick={onClick}
        className="flex w-full items-stretch gap-3 p-4 text-left hover:bg-slate-50"
      >
        <div className="w-16 flex-shrink-0 text-right">
          <p className={`font-semibold text-slate-900 ${timeTop.length > 5 ? 'text-xs leading-5' : 'text-sm'}`}>
            {timeTop}
          </p>
          {timeBottom && <p className="text-xs text-slate-400">{timeBottom}</p>}
        </div>
        <div className={`w-1 flex-shrink-0 rounded-full ${barClass}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {/* Long titles wrap instead of being cut off with an ellipsis: the
                card is the one place the whole name of an appointment shows. */}
            <h3 className="flex min-w-0 items-start gap-1.5 text-base font-semibold leading-snug text-slate-900">
              {isSynced && (
                <ExternalLink
                  size={12}
                  className="mt-1.5 flex-shrink-0 text-slate-400"
                  aria-label={sourceLabel}
                />
              )}
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{event.title}</span>
            </h3>
            {effort ? (
              <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${effort.badge}`}>
                {t(effort.labelKey)}
              </span>
            ) : (
              <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cat.chipBg} ${cat.chipText}`}>
                {tLabel(t, cat)}
              </span>
            )}
          </div>
          {eventKids.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {eventKids.map((kid) => (
                <span
                  key={kid.id}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${KID_CHIP[kid.color] || 'bg-slate-100 text-slate-700'}`}
                >
                  <span>🙂</span>
                  {kid.name}
                </span>
              ))}
            </div>
          )}
          {isSynced && showSource && (
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
              <ExternalLink size={12} className="flex-shrink-0" />
              <span className="truncate">{sourceLabel}</span>
            </div>
          )}
          {event.location && (
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={12} className="flex-shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          {event.responsibleParent && (
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <User size={12} className="flex-shrink-0" />
              {event.responsibleParent}
            </div>
          )}
          {event.description && !open && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">{event.description}</p>
          )}
        </div>
      </button>

      {/* A sibling of the main button, never nested inside it: a button within a
          button is invalid, and tapping the details must not open the editor. */}
      {hasDetails && (
        <>
          <button
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            className="flex w-full items-center justify-center gap-1 border-t border-slate-100 px-4 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
          >
            {open ? t('calendar.hideDetails') : t('calendar.showDetails')}
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {open && (
            <div className="space-y-2 border-t border-slate-100 px-4 py-3">
              {allDay && span && (
                <DetailRow icon={Clock}>
                  {`${formatDate(span.first, 'short')} – ${formatDate(span.last, 'short')}`}
                  <span className="text-slate-400">
                    {` · ${tn('calendar.spanDays', spanDays)}`}
                  </span>
                </DetailRow>
              )}
              {endsAt && (
                <DetailRow icon={Clock}>
                  {`${format(event.date, 'HH:mm')} – ${endLabel}`}
                  <span className="text-slate-400">
                    {` · ${formatDuration(event, { t, tn })}`}
                  </span>
                </DetailRow>
              )}
              {event.location && <DetailRow icon={MapPin}>{event.location}</DetailRow>}
              {repeats && <DetailRow icon={Repeat}>{repeats}</DetailRow>}
              {isSynced && <DetailRow icon={CalendarSync}>{sourceLabel}</DetailRow>}
              {event.description && (
                <p className="whitespace-pre-line text-sm text-slate-600">{event.description}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
