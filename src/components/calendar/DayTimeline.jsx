import { useMemo } from 'react';
import { format } from 'date-fns';
import { MapPin } from 'lucide-react';
import useCategories from '../../hooks/useCategories';
import useT from '../../hooks/useT';
import {
  HOUR_HEIGHT,
  layoutDay,
  minuteAtOffset,
  nowOffsetPx,
  splitAllDay,
} from '../../utils/dayTimeline';
import { eventDayCount, eventDayIndex, eventEnd, formatEventEnd } from '../../utils/eventTime';

// The day as an hour grid: every event sits at its start and is as tall as it
// runs, so a two-hour appointment reads as one at a glance. Overlapping events
// share the width side by side. All-day events sit in a strip above the grid.
//
// `onCreateAt(date)` is called with the day and time of a tap on an empty spot
// of the grid, rounded down to the half hour.
export default function DayTimeline({ day, events, onEventClick, onCreateAt }) {
  const { get: getCat } = useCategories();
  const { t } = useT();

  const { allDay, timed } = useMemo(() => splitAllDay(events, day), [events, day]);
  const { hours, heightPx, blocks, fromHour, toHour } = useMemo(
    () => layoutDay(timed, day),
    [timed, day],
  );

  function handleGridClick(e) {
    if (!onCreateAt || e.target.closest('button')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minute = minuteAtOffset(e.clientY - rect.top, fromHour);
    onCreateAt(new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minute / 60), minute % 60));
  }
  // Only meaningful while the day on screen is today; recomputed on each render,
  // which is often enough for a line that moves once a minute.
  const nowPx = nowOffsetPx(day, fromHour, toHour);

  return (
    <div className="rounded-2xl bg-white p-3 shadow-card">
      {allDay.length > 0 && (
        <div className="mb-3 flex gap-2 border-b border-slate-100 pb-3">
          <span className="w-12 flex-shrink-0 pr-2 pt-1 text-right text-[11px] leading-tight text-slate-400">
            {t('calendar.allDay')}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            {allDay.map((event) => {
              const cat = getCat(event.category);
              const n = eventDayCount(event);
              const i = n > 1 ? eventDayIndex(event, day) : 0;
              return (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm font-semibold ${cat.chipBg} ${cat.chipText}`}
                >
                  <span className="min-w-0 flex-1 break-words">{event.title}</span>
                  {i > 0 && (
                    <span className="flex-shrink-0 text-xs font-normal opacity-80">
                      {t('calendar.dayOfSpan', { i, n })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="relative flex">
        <div className="w-12 flex-shrink-0">
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR_HEIGHT }} className="relative">
              <span className="absolute -top-2 right-2 text-xs tabular-nums text-slate-400">
                {String(h).padStart(2, '0')}:00
              </span>
            </div>
          ))}
        </div>

        {/* A tap on free space starts a new event there; taps on a block are
            the block's own. */}
        <div
          className={`relative flex-1 ${onCreateAt ? 'cursor-pointer' : ''}`}
          style={{ height: heightPx }}
          onClick={handleGridClick}
        >
          {hours.map((h, i) => (
            <div
              key={h}
              style={{ top: i * HOUR_HEIGHT }}
              className="absolute inset-x-0 border-t border-slate-100"
            />
          ))}
          <div className="absolute inset-x-0 bottom-0 border-t border-slate-100" />

          {nowPx !== null && (
            <div
              style={{ top: nowPx }}
              className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
              aria-hidden="true"
            >
              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-rose-500" />
              <span className="h-px flex-1 bg-rose-500" />
            </div>
          )}

          {blocks.map(({ event, topPx, heightPx: blockHeight, lane, lanes, hasEnd, clipped, startMin }) => {
            const cat = getCat(event.category);
            const endLabel = hasEnd ? formatEventEnd(event) : null;
            // Lanes divide the width evenly; the small overlap keeps a block
            // from looking detached from the one beside it.
            const width = 100 / lanes;
            const tight = blockHeight < HOUR_HEIGHT * 0.75;
            const showLocation = !tight && blockHeight >= HOUR_HEIGHT * 1.4 && event.location;
            // Long titles wrap over as many lines as the block has room for
            // (after the padding and the time/location rows) instead of being
            // cut to one line with an ellipsis.
            const titleLineHeight = tight ? 16 : 20;
            const titleRoom = blockHeight - 8 - (tight ? 0 : 16) - (showLocation ? 18 : 0);
            const titleLines = Math.max(1, Math.floor(titleRoom / titleLineHeight));
            return (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                style={{
                  top: topPx,
                  height: blockHeight,
                  left: `${lane * width}%`,
                  width: `calc(${width}% - 4px)`,
                }}
                className={`absolute overflow-hidden rounded-xl px-2 py-1 text-left ${cat.chipBg} ${cat.chipText} ${
                  clipped ? 'rounded-b-none' : ''
                }`}
              >
                <span
                  style={{ WebkitLineClamp: titleLines }}
                  className={`break-words font-semibold [-webkit-box-orient:vertical] [display:-webkit-box] overflow-hidden ${
                    tight ? 'text-xs' : 'text-sm'
                  }`}
                  title={event.title}
                >
                  {event.title}
                </span>
                {!tight && (
                  <span className="block truncate text-xs opacity-80">
                    {/* Started the day before: only the end means anything here. */}
                    {startMin < 0 && endLabel
                      ? t('calendar.untilTime', { time: format(eventEnd(event), 'HH:mm') })
                      : `${format(event.date, 'HH:mm')}${endLabel ? ` – ${endLabel}` : ''}`}
                  </span>
                )}
                {showLocation && (
                  <span className="mt-0.5 flex items-center gap-1 truncate text-xs opacity-80">
                    <MapPin size={11} className="flex-shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-400">{t('calendar.timelineHint')}</p>
    </div>
  );
}
