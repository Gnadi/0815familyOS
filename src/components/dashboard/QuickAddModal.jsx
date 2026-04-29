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

export default function QuickAddModal({ open, onClose }) {
  const { user, userDoc } = useAuth();
  const { list: categories } = useCategories();

  const [tab, setTab] = useState('event');

  // Event fields
  const [evTitle, setEvTitle] = useState('');
  const [evTime, setEvTime] = useState('09:00');
  const [evCategory, setEvCategory] = useState(DEFAULT_CATEGORY);

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
          kids: [],
          responsibleParent: '',
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
      <div className="mb-4 flex rounded-xl border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => { setTab('event'); setError(''); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
            tab === 'event' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Calendar size={15} />
          Event
        </button>
        <button
          type="button"
          onClick={() => { setTab('task'); setError(''); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
            tab === 'task' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Category</span>
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
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
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
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Priority</span>
              <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
                {TASK_PRIORITIES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setTaskPriority(p.id)}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                      taskPriority === p.id
                        ? PRIORITY_ACTIVE[p.id]
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Category</span>
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
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
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
