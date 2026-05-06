import { Calendar, Check, GripVertical, Repeat, Users } from 'lucide-react';
import { format, isBefore, isSameDay, startOfDay } from 'date-fns';
import { useDraggable } from '@dnd-kit/core';
import AvatarStack from '../common/AvatarStack';
import { getTaskCategory, TASK_PRIORITY_MAP } from '../../constants/taskCategories';
import { formatRelativeDay } from '../../utils/date';
import { describeRecurrence } from '../../utils/recurrence';

function dueChipClasses(task) {
  if (task.status === 'completed') {
    return 'bg-slate-50 text-slate-500';
  }
  const today = startOfDay(new Date());
  const due = startOfDay(task.dueDate);
  if (isBefore(due, today) || isSameDay(due, today)) {
    return 'bg-red-50 text-red-600';
  }
  return 'bg-slate-50 text-slate-600';
}

function formatDueLabel(task) {
  if (!task.dueDate) return '—';
  const today = startOfDay(new Date());
  const due = startOfDay(task.dueDate);
  if (isSameDay(due, today)) return 'Today';
  if (isBefore(due, today)) return `Overdue · ${format(task.dueDate, 'MMM d')}`;
  return format(task.dueDate, 'MMM d');
}

function TaskCardBody({ task, members, dragging = false, overlay = false }) {
  const category = getTaskCategory(task.category);
  const priority = TASK_PRIORITY_MAP[task.priority] || TASK_PRIORITY_MAP.normal;
  const assigned = (task.assigneeIds || [])
    .map((id) => members.find((m) => m.uid === id))
    .filter(Boolean);
  const isInProgress = task.status === 'inProgress';
  const isCompleted = task.status === 'completed';
  const isShared = assigned.length >= 2;

  const completedLine = isCompleted && task.completedAt
    ? `Completed ${formatRelativeDay(task.completedAt)} ${format(task.completedAt, 'h:mm a')}`
    : null;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${category.chipBg} ${category.chipText}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} />
          {category.label}
        </span>
        <div className="flex items-center gap-1">
          {isCompleted && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check size={14} strokeWidth={3} />
            </span>
          )}
          {!overlay && (
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300"
              aria-hidden
            >
              <GripVertical size={14} />
            </span>
          )}
        </div>
      </div>

      <h3
        className={`mt-2 text-base font-semibold ${
          isCompleted ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-900'
        }`}
      >
        {task.title}
      </h3>
      {task.description && (
        <p className="mt-1 text-sm leading-snug text-slate-500 line-clamp-2">
          {task.description}
        </p>
      )}

      {isInProgress && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
            <span>Progress</span>
            <span className="tabular-nums text-slate-900">{task.progress || 0}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${Math.min(100, task.progress || 0)}%` }}
            />
          </div>
          {isShared && (
            <div className="mt-2 flex items-center justify-end">
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                <Users size={10} /> Shared Task
              </span>
            </div>
          )}
        </div>
      )}

      {isCompleted && completedLine && (
        <p className="mt-2 text-xs font-medium text-emerald-600">{completedLine}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${dueChipClasses(task)}`}
          >
            <Calendar size={12} />
            {formatDueLabel(task)}
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
            {task.points || 0} pts
          </span>
          {describeRecurrence(task.recurrence) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">
              <Repeat size={11} />
              {describeRecurrence(task.recurrence)}
            </span>
          )}
        </div>
        <AvatarStack members={assigned} max={3} size="sm" />
      </div>
    </>
  );
}

// Plain card rendered inside a DragOverlay (no drag hooks — the overlay
// already handles its own positioning).
export function TaskCardPreview({ task, members }) {
  return (
    <div className="w-full cursor-grabbing rounded-2xl bg-white p-4 text-left shadow-xl ring-2 ring-brand-400">
      <TaskCardBody task={task} members={members} overlay />
    </div>
  );
}

export default function TaskCard({ task, members, onClick }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { status: task.status },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onClick?.(task)}
      {...listeners}
      {...attributes}
      className={`block w-full touch-none cursor-grab rounded-2xl bg-white p-4 text-left shadow-card transition hover:shadow-md active:cursor-grabbing active:scale-[0.99] ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <TaskCardBody task={task} members={members} dragging={isDragging} />
    </button>
  );
}
