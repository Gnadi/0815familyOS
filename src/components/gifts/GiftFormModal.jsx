import { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';

const STATUSES = [
  { id: 'idea',   label: 'Idea' },
  { id: 'bought', label: 'Bought' },
  { id: 'gifted', label: 'Gifted' },
];

const STATUS_ACTIVE = {
  idea:   'bg-white text-slate-700 shadow-sm',
  bought: 'bg-white text-blue-700 shadow-sm',
  gifted: 'bg-white text-emerald-700 shadow-sm',
};

export default function GiftFormModal({ open, onClose, onSubmit, onDelete, initial, kids }) {
  const [title, setTitle] = useState('');
  const [kidId, setKidId] = useState('');
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState('idea');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title || '');
      setKidId(initial.kidId || '');
      setPrice(initial.price > 0 ? String(initial.price) : '');
      setStatus(initial.status || 'idea');
      setNotes(initial.notes || '');
    } else {
      setTitle('');
      setKidId(kids[0]?.id || '');
      setPrice('');
      setStatus('idea');
      setNotes('');
    }
    setError('');
  }, [open, initial, kids]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return setError('Please enter a gift title.');
    if (!kidId) return setError('Please select a recipient.');
    setError('');
    setSaving(true);
    try {
      await onSubmit({ title, kidId, price: parseFloat(price) || 0, status, notes });
    } catch (err) {
      setError(err.message || 'Could not save gift.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    const ok = window.confirm('Delete this gift? This cannot be undone.');
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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Gift' : 'New Gift'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Gift title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Wooden Block Set"
          required
          autoFocus
        />

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">For</span>
          {kids.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">No kids added yet. Add them in Settings first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {kids.map((kid) => (
                <button
                  key={kid.id}
                  type="button"
                  onClick={() => setKidId(kid.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    kidId === kid.id
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                  }`
                >
                  {kid.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Price <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
          </span>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">$</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-8 pr-4 text-base text-slate-900 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-500"
            />
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Status</span>
          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-600 dark:bg-slate-700">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatus(s.id)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                  status === s.id ? STATUS_ACTIVE[s.id] : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Notes <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
            placeholder="Link, size, or store info…"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          {isEdit && onDelete && (
            <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
              Delete
            </Button>
          )}
          <Button type="submit" loading={saving} className="ml-auto">
            {isEdit ? 'Save Changes' : 'Add Gift'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
