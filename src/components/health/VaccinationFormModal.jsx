import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import useT from '../../hooks/useT';

const STATUSES = [
  { id: 'done',    labelKey: 'health.statusDoneLabel' },
  { id: 'next_up', labelKey: 'health.statusNextUpLabel' },
  { id: 'pending', labelKey: 'health.statusPendingLabel' },
];

const STATUS_ACTIVE = {
  done:    'bg-white text-emerald-700 shadow-sm',
  next_up: 'bg-white text-brand-700 shadow-sm',
  pending: 'bg-white text-slate-700 shadow-sm',
};

const DATE_LABEL_KEY = {
  done:    'health.dateCompletedOn',
  next_up: 'health.dateDueDate',
  pending: 'health.dateScheduledFor',
};

function todayIso() {
  return format(new Date(), 'yyyy-MM-dd');
}

export default function VaccinationFormModal({ open, onClose, onSubmit, onDelete, initial }) {
  const { t } = useT();
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
    if (!name.trim()) return setError(t('health.errVaccineName'));
    if (!date) return setError(t('health.errDate'));
    setError('');
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), status, date });
    } catch (err) {
      setError(err.message || t('health.errSave'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    const ok = window.confirm(t('health.confirmDelete'));
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
    <Modal open={open} onClose={onClose} title={isEdit ? t('health.modalEdit') : t('health.modalNew')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('health.vaccineLabel')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('health.vaccinePlaceholder')}
          required
          autoFocus
        />

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('health.status')}</span>
          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatus(s.id)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                  status === s.id ? STATUS_ACTIVE[s.id] : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t(s.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <Input
          label={t(DATE_LABEL_KEY[status])}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          {isEdit && onDelete && (
            <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
              {t('common.delete')}
            </Button>
          )}
          <Button type="submit" loading={saving} className="ml-auto">
            {isEdit ? t('health.saveChanges') : t('health.addVaccination')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
