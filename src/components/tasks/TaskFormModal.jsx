import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import useFamilyMembers from '../../hooks/useFamilyMembers';
import {
  TASK_CATEGORY_LIST,
  TASK_PRIORITIES,
  TASK_STATUSES,
  DEFAULT_TASK_CATEGORY,
} from '../../constants/taskCategories';

function toDateInput(d) {
  return format(d, 'yyyy-MM-dd');
}

const PRIORITY_ACTIVE = {
  low:    'bg-white text-slate-700 shadow-sm',
  normal: 'bg-white text-brand-700 shadow-sm',
  high:   'bg-white text-amber-600 shadow-sm',
  urgent: 'bg-white text-red-600 shadow-sm',
};

const STATUS_ACTIVE = {
  backlog:    'bg-white text-slate-700 shadow-sm',
  planned:    'bg-white text-cyan-700 shadow-sm',
  inProgress: 'bg-white text-brand-700 shadow-sm',
  completed:  'bg-white text-emerald-700 shadow-sm',
};

export default function TaskFormModal({
  open,
  onClose,
  onSubmit,
  onDelete,
  initial,
}) {
  const familyMembers = useFamilyMembers();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(DEFAULT_TASK_CATEGORY);
  const [priority, setPriority] = useState('normal');
  const [status, setStatus] = useState('backlog');
  const [points, setPoints] = useState(3);
  const [dueDate, setDueDate] = useState(toDateInput(new Date()));
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title || '');
      setDescription(initial.description || '');
      setCategory(initial.category || DEFAULT_TASK_CATEGORY);
      setPriority(initial.priority || 'normal');
      setStatus(initial.status || 'backlog');
      setPoints(Number(initial.points) || 0);
      setDueDate(toDateInput(initial.dueDate || new Date()));
      setAssigneeIds(Array.isArray(initial.assigneeIds) ? initial.assigneeIds : []);
      setProgress(Number(initial.progress) || 0);
    } else {
      setTitle('');
      setDescription('');
      setCategory(DEFAULT_TASK_CATEGORY);
      setPriority('normal');
      setStatus('backlog');
      setPoints(3);
      setDueDate(toDateInput(new Date()));
      setAssigneeIds([]);
      setProgress(0);
    }
    setError('');
  }, [open, initial]);

  function toggleAssignee(uid) {
    setAssigneeIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return setError('Please enter a title.');
    if (!dueDate) return setError('Please pick a due date.');
    const [y, m, d] = dueDate.split('-').map(Number);
    const when = new Date(y, m - 1, d, 9, 0);
    setError('');
    setSaving(true);
    try {
      await onSubmit({
        title,
        description,
        category,
        priority,
        status,
        points: Number(points) || 0,
        dueDate: when,
        assigneeIds,
        progress: Number(progress) || 0,
        previousStatus: initial?.status,
      });
    } catch (err) {
      setError(err.message || 'Could not save task.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    const ok = window.confirm('Delete this task? This cannot be undone.');
    if (!ok) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  const isEdit = Boolean(initial);

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Task' : 'New Task'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Winter Gear Inventory"
          required
          autoFocus
        />

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Category</span>
          <div className="flex flex-wrap gap-2">
            {TASK_CATEGORY_LIST.map((cat) => {
              const active = category === cat.id;
              const chip = active
                ? `${cat.chipBg} ${cat.chipText} border-transparent shadow-sm`
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600';
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${chip}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${cat.dot}`} />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Priority</span>
          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-600 dark:bg-slate-700">
            {TASK_PRIORITIES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPriority(p.id)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                  priority === p.id ? PRIORITY_ACTIVE[p.id] : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Due date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
          <Input
            label="Story points"
            type="number"
            min={0}
            max={50}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            required
          />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Status</span>
          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-600 dark:bg-slate-700">
            {TASK_STATUSES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatus(s.id)}
                className={`flex-1 whitespace-nowrap rounded-lg px-1 py-2 text-xs font-medium transition ${
                  status === s.id ? STATUS_ACTIVE[s.id] : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {status === 'inProgress' && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Progress</span>
              <span className="text-sm font-semibold tabular-nums text-brand-600">
                {progress}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-brand-500"
            />
          </div>
        )}

        {familyMembers.length > 0 && (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Assignees <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {familyMembers.map((m) => {
                const active = assigneeIds.includes(m.uid);
                return (
                  <button
                    key={m.uid}
                    type="button"
                    onClick={() => toggleAssignee(m.uid)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? 'border-brand-500 bg-brand-500 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                    }`
                  >
                    {m.displayName}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Notes <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
            placeholder="Schedule the technician for annual filter change and inspection."
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          {isEdit && onDelete && (
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
            >
              Delete
            </Button>
          )}
          <Button type="submit" loading={saving} className="ml-auto">
            {isEdit ? 'Save Changes' : 'Create Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
