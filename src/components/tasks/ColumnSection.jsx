import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import TaskCard from './TaskCard';
import { summaryForColumn } from '../../utils/tasks';

const COLUMN_META = {
  backlog:    { label: 'Backlog',     chip: 'bg-slate-100 text-slate-700' },
  planned:    { label: 'Planned',     chip: 'bg-cyan-50 text-cyan-700'    },
  inProgress: { label: 'In Progress', chip: 'bg-brand-50 text-brand-700'  },
  completed:  { label: 'Completed',   chip: 'bg-emerald-50 text-emerald-700' },
};

export default function ColumnSection({
  status,
  tasks,
  members,
  onTaskClick,
  sectionRef,
  defaultCollapsed = false,
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const meta = COLUMN_META[status];
  const filtered = tasks.filter((t) => t.status === status);
  const summary = summaryForColumn(status, tasks);

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { status },
  });

  return (
    <section ref={sectionRef}>
      <div
        ref={setNodeRef}
        className={`rounded-2xl p-1 transition ${
          isOver ? 'bg-brand-50 ring-2 ring-brand-200' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="flex w-full items-start justify-between gap-2 rounded-xl px-2 py-2 text-left hover:bg-slate-50/60 dark:hover:bg-slate-700/40"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{meta.label}</h2>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.chip}`}>
                {summary.count}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>{summary.leftLabel}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className="tabular-nums text-slate-700 dark:text-slate-200">{summary.points} pts</span>
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className={`${summary.rightTone} font-semibold`}>{summary.rightLabel}</span>
            </div>
          </div>
          <span
            className={`mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition-transform ${
              collapsed ? '-rotate-90' : ''
            }`}
            aria-hidden
          >
            <ChevronDown size={18} />
          </span>
        </button>

        {!collapsed && (
          <div className="mt-2 space-y-3 px-1 pb-1">
            {filtered.length === 0 ? (
              <div
                className={`rounded-2xl border border-dashed p-4 text-center text-xs transition ${
                  isOver
                    ? 'border-brand-300 bg-white/80 text-brand-600 dark:bg-slate-700/80'
                    : 'border-slate-200 bg-white/60 text-slate-400 dark:border-slate-600 dark:bg-slate-800/30 dark:text-slate-500'
                }`}
              >
                {isOver ? `Drop to move to ${meta.label}` : `No tasks in ${meta.label.toLowerCase()} yet.`}
              </div>
            ) : (
              filtered.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  members={members}
                  onClick={onTaskClick}
                />
              ))
            )}
          </div>
        )}

        {collapsed && isOver && (
          <div className="mt-1 rounded-xl border border-dashed border-brand-300 bg-white/80 p-2 text-center text-xs font-medium text-brand-600">
            Drop to move to {meta.label}
          </div>
        )}
      </div>
    </section>
  );
}
