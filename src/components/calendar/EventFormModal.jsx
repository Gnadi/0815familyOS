import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import { CATEGORY_LIST, DEFAULT_CATEGORY } from '../../constants/eventCategories';

function toDateInput(d) {
  return format(d, 'yyyy-MM-dd');
}
function toTimeInput(d) {
  return format(d, 'HH:mm');
}

export default function EventFormModal({ open, onClose, onSubmit, onDelete, initial }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(toDateInput(new Date()));
  const [time, setTime] = useState('09:00');
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title || '');
      setDescription(initial.description || '');
      setDate(toDateInput(initial.date));
      setTime(toTimeInput(initial.date));
      setCategory(initial.category || DEFAULT_CATEGORY);
    } else {
      setTitle('');
      setDescription('');
      setDate(toDateInput(new Date()));
      setTime('09:00');
      setCategory(DEFAULT_CATEGORY);
    }
    setError('');
  }, [open, initial]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return setError('Please enter a title.');
    const [hh, mm] = time.split(':').map(Number);
    const [y, m, d] = date.split('-').map(Number);
    const when = new Date(y, m - 1, d, hh, mm);
    setError('');
    setSaving(true);
    try {
      await onSubmit({ title, description, date: when, category });
    } catch (err) {
      setError(err.message || 'Could not save event.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  const isEdit = Boolean(initial);

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Event' : 'New Event'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Soccer Practice"
          required
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <Input
            label="Time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Category</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_LIST.map((cat) => {
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
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

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Description (optional)
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            placeholder="Add notes"
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
            {isEdit ? 'Save Changes' : 'Create Event'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
