import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { formatRelativeDay, upcomingEvents } from '../../utils/date';
import { getCategory } from '../../constants/eventCategories';
import useEvents from '../../hooks/useEvents';
import useAuth from '../../hooks/useAuth';

export default function WeeklyPreview() {
  const { userDoc } = useAuth();
  const { events, loading } = useEvents(userDoc?.familyId);
  const next = upcomingEvents(events, new Date(), 3);

  return (
    <section>
      <div className="flex items-end justify-between">
        <h2 className="text-lg font-bold text-slate-900">Weekly Preview</h2>
        <Link to="/calendar" className="text-sm font-semibold text-brand-600">
          View All
        </Link>
      </div>

      <div className="mt-3 rounded-2xl bg-white shadow-card">
        {loading ? (
          <div className="px-4 py-6 text-center text-sm text-slate-400">Loading…</div>
        ) : next.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <Calendar size={18} />
            </div>
            <p className="mt-2 text-sm font-medium text-slate-700">No upcoming events</p>
            <Link to="/calendar" className="mt-2 text-sm font-semibold text-brand-600">
              Add your first event
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {next.map((ev) => {
              const cat = getCategory(ev.category);
              return (
                <li key={ev.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${cat.iconBg} ${cat.iconColor}`}
                  >
                    <Calendar size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{ev.title}</p>
                    <p className={`mt-0.5 truncate text-xs ${cat.chipText}`}>{cat.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatRelativeDay(ev.date)}</p>
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
