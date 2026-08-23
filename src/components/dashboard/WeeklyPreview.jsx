import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { dayKey, formatRelativeDay, upcomingEvents } from '../../utils/date';
import useEvents from '../../hooks/useEvents';
import useAuth from '../../hooks/useAuth';
import useCategories from '../../hooks/useCategories';
import useT from '../../hooks/useT';
import { tLabel } from '../../i18n/labels';
import { expandEventsInRange } from '../../utils/recurrence';

export default function WeeklyPreview() {
  const { userDoc } = useAuth();
  const { get: getCat } = useCategories();
  const { t } = useT();
  const { events, loading } = useEvents(userDoc?.familyId);
  // Only the next three entries are shown, but the expansion behind them ran on
  // every render. Keyed on the day so it survives unrelated re-renders.
  const todayStamp = dayKey(new Date());
  const next = useMemo(() => {
    const [y, m, d] = todayStamp.split('-').map(Number);
    const from = new Date(y, m, d);
    const horizon = new Date(y, m, d + 30, 23, 59, 59);
    const expanded = expandEventsInRange(events, from, horizon).sort((a, b) => a.date - b.date);
    return upcomingEvents(expanded, from, 3);
  }, [events, todayStamp]);

  return (
    <section>
      <div className="flex items-end justify-between">
        <h2 className="text-lg font-bold text-slate-900">{t('dashboard.weeklyPreview')}</h2>
        <Link to="/calendar" className="text-sm font-semibold text-brand-600">
          {t('dashboard.viewAll')}
        </Link>
      </div>

      <div className="mt-3 rounded-2xl bg-white shadow-card">
        {loading ? (
          <div className="px-4 py-6 text-center text-sm text-slate-400">{t('common.loading')}</div>
        ) : next.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <Calendar size={18} />
            </div>
            <p className="mt-2 text-sm font-medium text-slate-700">{t('dashboard.noUpcoming')}</p>
            <Link to="/calendar" className="mt-2 text-sm font-semibold text-brand-600">
              {t('dashboard.addFirstEvent')}
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {next.map((ev) => {
              const cat = getCat(ev.category);
              return (
                <li key={ev.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${cat.iconBg} ${cat.iconColor}`}
                  >
                    <Calendar size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{ev.title}</p>
                    <p className={`mt-0.5 truncate text-xs ${cat.chipText}`}>{tLabel(t, cat)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatRelativeDay(ev.date, t)}</p>
                    <p className="text-xs text-slate-500">{format(ev.date, 'p')}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
