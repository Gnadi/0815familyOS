import { useState } from 'react';
import { Calendar, CheckSquare, Plus, Sun } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { eventsOnDay } from '../../utils/date';
import useAuth from '../../hooks/useAuth';
import useEvents from '../../hooks/useEvents';
import useTasks from '../../hooks/useTasks';
import useCategories from '../../hooks/useCategories';
import { getTaskCategory, TASK_PRIORITY_MAP } from '../../constants/taskCategories';
import QuickAddModal from './QuickAddModal';

const PRIORITY_WEIGHT = { urgent: 0, high: 1, normal: 2, low: 3 };

export default function DailyPreview() {
  const { userDoc } = useAuth();
  const { get: getCat } = useCategories();
  const { events, loading: evLoading } = useEvents(userDoc?.familyId);
  const { tasks, loading: taskLoading } = useTasks(userDoc?.familyId);
  const [showAdd, setShowAdd] = useState(false);

  const today = new Date();
  const todayLabel = format(today, 'EEE, MMM d');

  const todayEvents = eventsOnDay(events, today).sort((a, b) => a.date - b.date);
  const todayTasks = tasks
    .filter((t) => t.dueDate && isSameDay(t.dueDate, today) && t.status !== 'completed')
    .sort((a, b) => (PRIORITY_WEIGHT[a.priority] ?? 2) - (PRIORITY_WEIGHT[b.priority] ?? 2));

  const loading = evLoading || taskLoading;
  const isEmpty = todayEvents.length === 0 && todayTasks.length === 0;

  return (
    <section>
      <div className="flex items-end justify-between">
        <h2 className="text-lg font-bold text-slate-900">Today</h2>
        <span className="text-sm text-slate-400">{todayLabel}</span>
      </div>

      <div className="mt-3 rounded-2xl bg-white shadow-card">
        {loading ? (
          <div className="px-4 py-6 text-center text-sm text-slate-400">Loading…</div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-400">
              <Sun size={18} />
            </div>
            <p className="mt-2 text-sm font-medium text-slate-700">Nothing scheduled for today</p>
            <p className="mt-0.5 text-xs text-slate-400">Enjoy the free time — or add something below.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {todayEvents.length > 0 && (
              <div className="px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Events
                </p>
                <ul className="space-y-2">
                  {todayEvents.map((ev) => {
                    const cat = getCat(ev.category);
                    return (
                      <li key={ev.id} className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${cat.iconBg} ${cat.iconColor}`}
                        >
                          <Calendar size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{ev.title}</p>
                          <p className={`text-xs ${cat.chipText}`}>{cat.label}</p>
                        </div>
                        <span className="flex-shrink-0 text-xs font-medium text-slate-500">
                          {format(ev.date, 'p')}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {todayTasks.length > 0 && (
              <div className="px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Tasks due today
                </p>
                <ul className="space-y-2">
                  {todayTasks.map((task) => {
                    const taskCat = getTaskCategory(task.category);
                    const prio = TASK_PRIORITY_MAP[task.priority];
                    return (
                      <li key={task.id} className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
                          <CheckSquare size={16} className="text-slate-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{task.title}</p>
                          <p className={`text-xs ${taskCat.chipText}`}>{taskCat.label}</p>
                        </div>
                        {prio && (
                          <span className="flex flex-shrink-0 items-center gap-1 text-xs text-slate-500">
                            <span className={`h-2 w-2 rounded-full ${prio.dot}`} />
                            {prio.label}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="px-4 pb-4 pt-2">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-semibold text-brand-600 transition hover:bg-slate-50"
          >
            <Plus size={16} />
            Add event or task
          </button>
        </div>
      </div>

      <QuickAddModal open={showAdd} onClose={() => setShowAdd(false)} />
    </section>
  );
}
