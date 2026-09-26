import { useMemo } from 'react';
import { format } from 'date-fns';
import { MapPin } from 'lucide-react';
import useCategories from '../../hooks/useCategories';
import useT from '../../hooks/useT';
import { HOUR_HEIGHT, layoutDay, nowOffsetPx } from '../../utils/dayTimeline';
import { formatEventEnd } from '../../utils/eventTime';

// The day as an hour grid: every event sits at its start and is as tall as it
// runs, so a two-hour appointment reads as one at a glance. Overlapping events
// share the width side by side.
export default function DayTimeline({ day, events, onEventClick }) {
  const { get: getCat } = useCategories();
  const { t } = useT();

  const { hours, heightPx, blocks, fromHour, toHour } = useMemo(
    () => layoutDay(events, day),
    [events, day],
  );
  // Only meaningful while the day on screen is today; recomputed on each render,
  // which is often enough for a line that moves once a minute.
  const nowPx = nowOffsetPx(day, fromHour, toHour);

  return (
    <div className="rounded-2xl bg-white p-3 shadow-card">
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

        <div className="relative flex-1" style={{ height: heightPx }}>
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

          {blocks.map(({ event, topPx, heightPx: blockHeight, lane, lanes, hasEnd, clipped }) => {
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
                    {format(event.date, 'HH:mm')}
                    {endLabel ? ` – ${endLabel}` : ''}
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
