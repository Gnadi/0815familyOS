import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import {
  addMonths,
  dayKey,
  formatDate,
  getMonthGrid,
  groupEventsByDay,
  NO_EVENTS,
  subMonths,
} from '../../utils/date';
import useCategories from '../../hooks/useCategories';
import useT from '../../hooks/useT';
import useSwipe from '../../hooks/useSwipe';
import DayAgenda from './DayAgenda';
import TodayButton from './TodayButton';

export default function MonthView({
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
  const swipe = useSwipe({
    onLeft: () => onAnchorChange(addMonths(anchor, 1)),
    onRight: () => onAnchorChange(subMonths(anchor, 1)),
  });
  // The grid only changes with the month, and each cell's key and label are
  // worked out once with it rather than formatted again on every render.
  const monthIndex = anchor.getFullYear() * 12 + anchor.getMonth();
  const grid = useMemo(() => {
    const month = monthIndex % 12;
    return getMonthGrid(anchor).map((d) => ({
      date: d,
      key: dayKey(d),
      label: d.getDate(),
      inMonth: d.getMonth() === month,
    }));
    // `anchor` is read only for its month, which `monthIndex` stands for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthIndex]);
  const weekdayLabels = useMemo(
    () => grid.slice(0, 7).map((cell) => ({ key: cell.key, label: format(cell.date, 'EEEEE') })),
    [grid],
  );
  // One pass over the events instead of one full scan per grid cell (42 of
  // them), on every render.
  const byDay = useMemo(() => groupEventsByDay(events), [events]);
  const selectedKey = dayKey(selected);
  const dayEvents = byDay.get(selectedKey) || NO_EVENTS;

  return (
    <div>
      <div className="rounded-2xl bg-white p-4 shadow-card" {...swipe}>
        {/* Same shape as the week view's header: month left, controls right. */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            {format(anchor, 'MMMM yyyy')}
          </h3>
          <div className="flex items-center gap-1">
            <TodayButton selected={selected} onJump={onAnchorChange} />
            <button
              onClick={() => onAnchorChange(subMonths(anchor, 1))}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              aria-label={t('calendar.prevMonth')}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => onAnchorChange(addMonths(anchor, 1))}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              aria-label={t('calendar.nextMonth')}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7 text-center text-xs font-medium text-slate-400">
          {weekdayLabels.map((w) => (
            <span key={w.key}>{w.label}</span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {grid.map(({ date: d, key, label, inMonth }) => {
            const active = key === selectedKey;
            const dayEvs = byDay.get(key) || NO_EVENTS;
            const categories = [...new Set(dayEvs.map((e) => e.category))].slice(0, 3);
            return (
              <button
                key={key}
                onClick={() => onSelect(d)}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition ${
                  active
                    ? 'bg-brand-500 text-white shadow-xs'
                    : inMonth
                    ? 'text-slate-900 hover:bg-slate-100'
                    : 'text-slate-300'
                }`}
              >
                <span className={active ? 'font-bold' : 'font-medium'}>{label}</span>
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
        <DayAgenda
          day={selected}
          events={dayEvents}
          onEventClick={onEventClick}
          onCreateAt={onCreateAt}
          title={t('calendar.eventsOn', { date: formatDate(selected, 'long') })}
        />
      </div>
    </div>
  );
}
