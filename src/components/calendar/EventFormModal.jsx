import { useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import useCategories from '../../hooks/useCategories';
import useAuth from '../../hooks/useAuth';
import useFamilyMembers from '../../hooks/useFamilyMembers';
import { addFamilyCategory, deleteCategory, addKid } from '../../services/families';
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

function AddKidForm({ onCreated, onCancel, familyId, existingKidsCount }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e) {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = name.trim();
    if (!trimmed) return setError('Name is required.');
    setError('');
    setSaving(true);
    try {
      const created = await addKid(familyId, trimmed, existingKidsCount);
      onCreated(created);
    } catch (err) {
      setError(err.message || 'Could not add child.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Add child</span>
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
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Emma, Noah"
        maxLength={24}
        autoFocus
        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" onClick={handleSave} loading={saving}>
          Add child
        </Button>
      </div>
    </div>
  );
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

export default function EventFormModal({
  open,
  onClose,
  onSubmit,
  onDelete,
  initial,
  initialDate,
}) {
  const { userDoc, family } = useAuth();
  const { list: categories } = useCategories();
  const familyMembers = useFamilyMembers();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(toDateInput(new Date()));
  const [time, setTime] = useState('09:00');
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [kids, setKids] = useState([]);
  const [responsibleParent, setResponsibleParent] = useState('');
  const [effortLevel, setEffortLevel] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [addingKid, setAddingKid] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const familyKids = family?.kids || [];

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title || '');
      setDescription(initial.description || '');
      setDate(toDateInput(initial.date));
      setTime(toTimeInput(initial.date));
      setCategory(initial.category || DEFAULT_CATEGORY);
      setKids(initial.kids || []);
      setResponsibleParent(initial.responsibleParent || '');
      setEffortLevel(initial.effortLevel || '');
    } else {
      setTitle('');
      setDescription('');
      setDate(toDateInput(initialDate || new Date()));
      setTime('09:00');
      setCategory(DEFAULT_CATEGORY);
      setKids([]);
      setResponsibleParent('');
      setEffortLevel('medium');
    }
    setCreatingCategory(false);
    setAddingKid(false);
    setDeletingCategoryId(null);
    setError('');
  }, [open, initial, initialDate]);

  async function handleDeleteCategory(cat) {
    if (!userDoc?.familyId) return;
    const ok = window.confirm(
      `Delete category "${cat.label}"? Events in this category will be moved to General.`
    );
    if (!ok) return;
    setDeletingCategoryId(cat.id);
    try {
      await deleteCategory(userDoc.familyId, cat);
      if (category === cat.id) setCategory(DEFAULT_CATEGORY);
    } catch (err) {
      setError(err.message || 'Could not delete category.');
    } finally {
      setDeletingCategoryId(null);
    }
  }

  function toggleKid(kidId) {
    setKids((prev) =>
      prev.includes(kidId) ? prev.filter((id) => id !== kidId) : [...prev, kidId]
    );
  }

  function selectAllKids() {
    const allIds = familyKids.map((k) => k.id);
    const allSelected = allIds.every((id) => kids.includes(id));
    setKids(allSelected ? [] : allIds);
  }

  function toggleParent(label) {
    setResponsibleParent((prev) => (prev === label ? '' : label));
  }

  function toggleEffort(level) {
    setEffortLevel((prev) => (prev === level ? '' : level));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return setError('Please enter a title.');
    const [hh, mm] = time.split(':').map(Number);
    const [y, m, d] = date.split('-').map(Number);
    const when = new Date(y, m - 1, d, hh, mm);
    setError('');
    setSaving(true);
    try {
      await onSubmit({ title, description, date: when, category, kids, responsibleParent, effortLevel });
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
  const allKidsSelected =
    familyKids.length >= 2 && familyKids.every((k) => kids.includes(k.id));

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

        {/* Kids */}
        {(familyKids.length > 0 || userDoc?.familyId) && (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Child <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {familyKids.map((kid) => {
                const active = kids.includes(kid.id);
                const colorClass = active
                  ? (KID_CHIP_ACTIVE[kid.color] || 'bg-brand-500 text-white border-brand-500')
                  : (KID_CHIP_COLORS[kid.color] || 'bg-slate-100 text-slate-700 border-slate-200');
                return (
                  <button
                    key={kid.id}
                    type="button"
                    onClick={() => toggleKid(kid.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${colorClass}`}
                  >
                    {kid.name}
                  </button>
                );
              })}
              {familyKids.length >= 2 && (
                <button
                  type="button"
                  onClick={selectAllKids}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    allKidsSelected
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {familyKids.length === 2 ? 'Both' : 'All'}
                </button>
              )}
              {!addingKid && userDoc?.familyId && (
                <button
                  type="button"
                  onClick={() => setAddingKid(true)}
                  className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
                >
                  <Plus size={14} /> Add child
                </button>
              )}
            </div>
            {addingKid && userDoc?.familyId && (
              <AddKidForm
                familyId={userDoc.familyId}
                existingKidsCount={familyKids.length}
                onCancel={() => setAddingKid(false)}
                onCreated={(kid) => {
                  setKids((prev) => [...prev, kid.id]);
                  setAddingKid(false);
                }}
              />
            )}
          </div>
        )}

        {/* Responsible */}
        {familyMembers.length > 0 && (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Responsible <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
              {familyMembers.map((member) => (
                <button
                  key={member.uid}
                  type="button"
                  onClick={() => toggleParent(member.displayName)}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                    responsibleParent === member.displayName
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {member.displayName}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Effort Level */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Effort Level <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
            {[
              { value: 'low', label: 'Low', active: 'bg-white text-green-700 shadow-sm' },
              { value: 'medium', label: 'Medium', active: 'bg-white text-amber-600 shadow-sm' },
              { value: 'high', label: 'High', active: 'bg-white text-rose-600 shadow-sm' },
            ].map(({ value, label, active }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleEffort(value)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                  effortLevel === value ? active : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Category</span>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const active = category === cat.id;
              const deletable = cat.id !== DEFAULT_CATEGORY;
              const isDeleting = deletingCategoryId === cat.id;
              const chipClasses = active
                ? `${cat.chipBg} ${cat.chipText} border-transparent shadow-sm`
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50';
              return (
                <div
                  key={cat.id}
                  className={`flex items-center rounded-full border text-sm font-medium transition ${chipClasses} ${
                    isDeleting ? 'opacity-60' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    disabled={isDeleting}
                    className={`flex items-center gap-2 py-1.5 pl-3 ${
                      deletable ? 'pr-1.5' : 'pr-3'
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${cat.dot}`} />
                    {cat.label}
                  </button>
                  {deletable && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat)}
                      disabled={isDeleting}
                      aria-label={`Delete category ${cat.label}`}
                      className="flex h-6 w-6 items-center justify-center rounded-full opacity-60 hover:bg-black/5 hover:opacity-100 disabled:cursor-not-allowed mr-1"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
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
            Notes (optional)
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            placeholder="Add any special instructions or details..."
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
            {isEdit ? 'Save Changes' : 'Save Event'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
