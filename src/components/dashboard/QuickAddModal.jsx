import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Calendar, CheckSquare } from 'lucide-react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import useAuth from '../../hooks/useAuth';
import useCategories from '../../hooks/useCategories';
import { createEvent } from '../../services/events';
import { createTask } from '../../services/tasks';
import { DEFAULT_CATEGORY } from '../../constants/eventCategories';
import {
  DEFAULT_TASK_CATEGORY,
  TASK_CATEGORY_LIST,
  TASK_PRIORITIES,
} from '../../constants/taskCategories';

const PRIORITY_ACTIVE = {
  low:    'bg-white text-slate-700 shadow-sm',
  normal: 'bg-white text-brand-700 shadow-sm',
  high:   'bg-white text-amber-600 shadow-sm',
  urgent: 'bg-white text-red-600 shadow-sm',
};

function todayDateInput() {
  return format(new Date(), 'yyyy-MM-dd');
}

const KID_CHIP_COLORS = {
  violet: 'bg-violet-100 text-violet-700 border-violet-300',
  sky:    'bg-sky-100 text-sky-700 border-sky-300',
  pink:   'bg-pink-100 text-pink-700 border-pink-300',
  teal:   'bg-teal-100 text-teal-700 border-teal-300',
  orange: 'bg-orange-100 text-orange-700 border-orange-300',
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-300',
};
const KID_CHIP_ACTIVE = {
  violet: 'bg-violet-500 text-white border-violet-500',
  sky:    'bg-sky-500 text-white border-sky-500',
  pink:   'bg-pink-500 text-white border-pink-500',
  teal:   'bg-teal-500 text-white border-teal-500',
  orange: 'bg-orange-500 text-white border-orange-500',
  indigo: 'bg-indigo-500 text-white border-indigo-500',
};

export default function QuickAddModal({ open, onClose }) {
  const { user, userDoc, family } = useAuth();
  const { list: categories } = useCategories();
  const familyKids = family?.kids || [];

  const [tab, setTab] = useState('event');

  // Event fields
  const [evTitle, setEvTitle] = useState('');
  const [evTime, setEvTime] = useState('09:00');
  const [evCategory, setEvCategory] = useState(DEFAULT_CATEGORY);
  const [evKids, setEvKids] = useState([]);

  // Task fields
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState('normal');
  const [taskDueDate, setTaskDueDate] = useState(todayDateInput());
  const [taskCategory, setTaskCategory] = useState(DEFAULT_TASK_CATEGORY);

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab('event');
    setEvTitle('');
    setEvTime('09:00');
    setEvCategory(DEFAULT_CATEGORY);
    setEvKids([]);
    setTaskTitle('');
    setTaskPriority('normal');
    setTaskDueDate(todayDateInput());
    setTaskCategory(DEFAULT_TASK_CATEGORY);
    setError('');
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!userDoc?.familyId || !user?.uid) return;

    if (tab === 'event') {
      if (!evTitle.trim()) return setError('Please enter a title.');
      const [hh, mm] = evTime.split(':').map(Number);
      const today = new Date();
      const when = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hh, mm);
      setError('');
      setSaving(true);
      try {
        await createEvent({
          familyId: userDoc.familyId,
          userId: user.uid,
          title: evTitle.trim(),
          description: '',
          date: when,
          category: evCategory,
          kids: evKids,
          responsibleParent: userDoc?.displayName || '',
          effortLevel: '',
        });
        onClose();
      } catch (err) {
        setError(err.message || 'Could not save event.');
      } finally {
        setSaving(false);
      }
    } else {
      if (!taskTitle.trim()) return setError('Please enter a title.');
      if (!taskDueDate) return setError('Please pick a due date.');
      const [y, m, d] = taskDueDate.split('-').map(Number);
      const dueAt = new Date(y, m - 1, d, 9, 0);
      setError('');
      setSaving(true);
      try {
        await createTask({
          familyId: userDoc.familyId,
          userId: user.uid,
          title: taskTitle.trim(),
          description: '',
          status: 'planned',
          priority: taskPriority,
          category: taskCategory,
          points: 0,
          dueDate: dueAt,
          assigneeIds: [],
          progress: 0,
        });
        onClose();
      } catch (err) {
        setError(err.message || 'Could not save task.');
      } finally {
        setSaving(false);
      }
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Quick Add">
      {/* Tab toggle */}
      <div className="mb-4 flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-600 dark:bg-slate-700">
        <button
          type="button"
          onClick={() => { setTab('event'); setError(''); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
            tab === 'event' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Calendar size={15} />
          Event
        </button>
        <button
          type="button"
          onClick={() => { setTab('task'); setError(''); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
            tab === 'task' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <CheckSquare size={15} />
          Task
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {tab === 'event' ? (
          <>
            <Input
              label="Title"
              value={evTitle}
              onChange={(e) => setEvTitle(e.target.value)}
              placeholder="Soccer Practice"
              required
              autoFocus
            />
            <Input
              label="Time (today)"
              type="time"
              value={evTime}
              onChange={(e) => setEvTime(e.target.value)}
              required
            />
            {familyKids.length > 0 && (
              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Child <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {familyKids.map((kid) => {
                    const active = evKids.includes(kid.id);
                    const colorClass = active
                      ? (KID_CHIP_ACTIVE[kid.color] || 'bg-brand-500 text-white border-brand-500')
                      : (KID_CHIP_COLORS[kid.color] || 'bg-slate-100 text-slate-700 border-slate-200');
                    return (
                      <button
                        key={kid.id}
                        type="button"
                        onClick={() =>
                          setEvKids((prev) =>
                            prev.includes(kid.id)
                              ? prev.filter((id) => id !== kid.id)
                              : [...prev, kid.id]
                          )
                        }
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${colorClass}`}
                      >
                        {kid.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Category</span>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const active = evCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setEvCategory(cat.id)}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        active
                          ? `${cat.chipBg} ${cat.chipText} border-transparent shadow-sm`
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${cat.dot}`} />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <Input
              label="Title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Winter Gear Inventory"
              required
              autoFocus
            />
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Priority</span>
              <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-600 dark:bg-slate-700">
                {TASK_PRIORITIES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setTaskPriority(p.id)}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                      taskPriority === p.id
                        ? PRIORITY_ACTIVE[p.id]
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Category</span>
              <div className="flex flex-wrap gap-2">
                {TASK_CATEGORY_LIST.map((cat) => {
                  const active = taskCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setTaskCategory(cat.id)}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        active
                          ? `${cat.chipBg} ${cat.chipText} border-transparent shadow-sm`
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${cat.dot}`} />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Input
              label="Due date"
              type="date"
              value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
              required
            />
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="pt-1">
          <Button type="submit" loading={saving} className="w-full">
            {tab === 'event' ? 'Add Event' : 'Add Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
