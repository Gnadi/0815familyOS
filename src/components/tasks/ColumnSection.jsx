import { MoreVertical } from 'lucide-react';
import TaskCard from './TaskCard';
import { summaryForColumn } from '../../utils/tasks';

const COLUMN_META = {
  backlog:    { label: 'Backlog',     chip: 'bg-slate-100 text-slate-700' },
  inProgress: { label: 'In Progress', chip: 'bg-brand-50 text-brand-700'  },
  completed:  { label: 'Completed',   chip: 'bg-emerald-50 text-emerald-700' },
};

export default function ColumnSection({ status, tasks, members, onTaskClick, sectionRef }) {
  const meta = COLUMN_META[status];
  const filtered = tasks.filter((t) => t.status === status);
  const summary = summaryForColumn(status, tasks);

  return (
    <section ref={sectionRef} className="space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">{meta.label}</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.chip}`}>
              {summary.count}
            </span>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
            aria-label="Column options"
          >
            <MoreVertical size={18} />
          </button>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-500">
          <span>{summary.leftLabel}</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="tabular-nums text-slate-700">{summary.points} pts</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className={`${summary.rightTone} font-semibold`}>{summary.rightLabel}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-4 text-center text-xs text-slate-400">
          No tasks in {meta.label.toLowerCase()} yet.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              members={members}
              onClick={onTaskClick}
            />
          ))}
        </div>
      )}
    </section>
  );
}
