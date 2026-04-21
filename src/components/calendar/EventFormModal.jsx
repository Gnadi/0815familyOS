import { useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import useCategories from '../../hooks/useCategories';
import useAuth from '../../hooks/useAuth';
import { addFamilyCategory } from '../../services/families';
import {
  COLOR_PALETTE,
  DEFAULT_CATEGORY,
  PALETTE_COLORS,
} from '../../constants/eventCategories';

function toDateInput(d) {
  return format(d, 'yyyy-MM-dd');
}
function toTimeInput(d) {
  return format(d, 'HH:mm');
}

function NewCategoryForm({ onCreated, onCancel, familyId }) {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(PALETTE_COLORS[1]); // default to blue
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e) {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = label.trim();
    if (!trimmed) return setError('Name is required.');
    setError('');
    setSaving(true);
    try {
      const created = await addFamilyCategory(familyId, { label: trimmed, color });
      onCreated(created);
    } catch (err) {
      setError(err.message || 'Could not add category.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">New category</span>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full p-1 text-slate-500 hover:bg-slate-200"
          aria-label="Cancel"
        >
          <X size={14} />
        </button>
      </div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Work, School, Pets"
        maxLength={24}
        autoFocus
        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {PALETTE_COLORS.map((c) => {
          const active = color === c;
          const swatch = COLOR_PALETTE[c].swatch;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              className={`flex h-7 w-7 items-center justify-center rounded-full ${swatch} ring-offset-2 transition ${
                active ? 'ring-2 ring-slate-900' : 'hover:opacity-80'
              }`}
            >
              {active && <Check size={14} className="text-white" />}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" onClick={handleSave} loading={saving}>
          Add category
        </Button>
      </div>
    </div>
  );
}

export default function EventFormModal({ open, onClose, onSubmit, onDelete, initial }) {
  const { userDoc } = useAuth();
  const { list: categories } = useCategories();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(toDateInput(new Date()));
  const [time, setTime] = useState('09:00');
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [creatingCategory, setCreatingCategory] = useState(false);
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
    setCreatingCategory(false);
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
            {categories.map((cat) => {
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
            {!creatingCategory && userDoc?.familyId && (
              <button
                type="button"
                onClick={() => setCreatingCategory(true)}
                className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
              >
                <Plus size={14} /> New
              </button>
            )}
          </div>

          {creatingCategory && userDoc?.familyId && (
            <NewCategoryForm
              familyId={userDoc.familyId}
              onCancel={() => setCreatingCategory(false)}
              onCreated={(cat) => {
                setCategory(cat.id);
                setCreatingCategory(false);
              }}
            />
          )}
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
