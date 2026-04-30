import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';

const STATUSES = [
  { id: 'done',    label: 'Done' },
  { id: 'next_up', label: 'Next Up' },
  { id: 'pending', label: 'Pending' },
];

const STATUS_ACTIVE = {
  done:    'bg-white text-emerald-700 shadow-sm',
  next_up: 'bg-white text-brand-700 shadow-sm',
  pending: 'bg-white text-slate-700 shadow-sm',
};

const DATE_LABEL = {
  done:    'Completed on',
  next_up: 'Due date',
  pending: 'Scheduled for',
};

function todayIso() {
  return format(new Date(), 'yyyy-MM-dd');
}

export default function VaccinationFormModal({ open, onClose, onSubmit, onDelete, initial }) {
  const [name, setName]       = useState('');
  const [status, setStatus]   = useState('pending');
  const [date, setDate]       = useState(todayIso());
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name || '');
      setStatus(initial.status || 'pending');
      setDate(initial.date || todayIso());
    } else {
      setName('');
      setStatus('pending');
      setDate(todayIso());
    }
    setError('');
  }, [open, initial]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Please enter a vaccine name.');
    if (!date) return setError('Please pick a date.');
    setError('');
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), status, date });
    } catch (err) {
      setError(err.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    const ok = window.confirm('Remove this vaccination record? This cannot be undone.');
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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Vaccination' : 'New Vaccination'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Vaccine"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. MMR Booster"
          required
          autoFocus
        />

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

        <Input
          label={DATE_LABEL[status]}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          {isEdit && onDelete && (
            <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
              Delete
            </Button>
          )}
          <Button type="submit" loading={saving} className="ml-auto">
            {isEdit ? 'Save Changes' : 'Add Vaccination'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
