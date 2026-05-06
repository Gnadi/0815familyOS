import { useState } from 'react';
import { Calendar, CheckSquare, Plus, Sun } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { eventsOnDay } from '../../utils/date';
import useAuth from '../../hooks/useAuth';
import useEvents from '../../hooks/useEvents';
import useTasks from '../../hooks/useTasks';
import useCategories from '../../hooks/useCategories';
import useFamilyMembers from '../../hooks/useFamilyMembers';
import { getTaskCategory, TASK_PRIORITY_MAP } from '../../constants/taskCategories';
import { expandEventsInRange } from '../../utils/recurrence';
import QuickAddModal from './QuickAddModal';

const PRIORITY_WEIGHT = { urgent: 0, high: 1, normal: 2, low: 3 };

export default function DailyPreview() {
  const { userDoc, family } = useAuth();
  const { get: getCat } = useCategories();
  const { events, loading: evLoading } = useEvents(userDoc?.familyId);
  const { tasks, loading: taskLoading } = useTasks(userDoc?.familyId);
  const members = useFamilyMembers();
  const [showAdd, setShowAdd] = useState(false);

  const today = new Date();
  const todayLabel = format(today, 'EEE, MMM d');
  const familyKids = family?.kids || [];

  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
  const expandedToday = expandEventsInRange(events, dayStart, dayEnd);
  const todayEvents = eventsOnDay(expandedToday, today).sort((a, b) => a.date - b.date);
  const todayTasks = tasks
    .filter((t) => t.dueDate && isSameDay(t.dueDate, today) && t.status !== 'completed')
    .sort((a, b) => (PRIORITY_WEIGHT[a.priority] ?? 2) - (PRIORITY_WEIGHT[b.priority] ?? 2));

  // Group tasks by assignee, preserving member list order. Tasks with no
  // assignees collect in a trailing "Unassigned" bucket.
  const taskGroups = [];
  members.forEach((m) => {
    const mt = todayTasks.filter((t) => t.assigneeIds.includes(m.uid));
    if (mt.length) taskGroups.push({ name: m.displayName, tasks: mt });
  });
  const unassigned = todayTasks.filter((t) => !t.assigneeIds.length);
  if (unassigned.length) taskGroups.push({ name: 'Unassigned', tasks: unassigned });

  // If no members loaded yet but tasks exist, fall back to a single flat group
  const flatFallback = taskGroups.length === 0 && todayTasks.length > 0;

  function kidNames(kidIds) {
    if (!kidIds?.length) return null;
    return kidIds
      .map((id) => familyKids.find((k) => k.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  }

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
                <ul className="space-y-2.5">
                  {todayEvents.map((ev) => {
                    const cat = getCat(ev.category);
                    const kids = kidNames(ev.kids);
                    const meta = [kids, ev.responsibleParent].filter(Boolean).join(' · ');
                    return (
                      <li key={ev.id} className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${cat.iconBg} ${cat.iconColor}`}
                        >
                          <Calendar size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{ev.title}</p>
                          {meta ? (
                            <p className="mt-0.5 truncate text-xs text-slate-500">{meta}</p>
                          ) : (
                            <p className={`mt-0.5 truncate text-xs ${cat.chipText}`}>{cat.label}</p>
                          )}
                        </div>
                        <span className="mt-0.5 flex-shrink-0 text-xs font-medium text-slate-500">
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
                {flatFallback ? (
                  <ul className="space-y-2">
                    {todayTasks.map((task) => <TaskRow key={task.id} task={task} />)}
                  </ul>
                ) : (
                  <div className="space-y-3">
                    {taskGroups.map((group) => (
                      <div key={group.name}>
                        <p className="mb-1.5 text-xs font-semibold text-slate-700">{group.name}</p>
                        <ul className="space-y-1.5">
                          {group.tasks.map((task) => <TaskRow key={task.id} task={task} indent />)}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
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

function TaskRow({ task, indent = false }) {
  const taskCat = getTaskCategory(task.category);
  const prio = TASK_PRIORITY_MAP[task.priority];
  return (
    <li className={`flex items-center gap-2 ${indent ? 'pl-1' : ''}`}>
      <CheckSquare size={14} className="flex-shrink-0 text-slate-300" />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{task.title}</span>
      {prio && (
        <span className="flex flex-shrink-0 items-center gap-1 text-xs text-slate-400">
          <span className={`h-1.5 w-1.5 rounded-full ${prio.dot}`} />
          {prio.label}
        </span>
      )}
    </li>
  );
}
