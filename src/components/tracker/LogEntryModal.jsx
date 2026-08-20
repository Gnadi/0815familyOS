import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import useT from '../../hooks/useT';

// <input type="datetime-local"> speaks local wall-clock time with no zone, so
// both directions go through date-fns rather than toISOString() (which would
// shift the value by the UTC offset).
const LOCAL_FMT = "yyyy-MM-dd'T'HH:mm";

function toLocalInput(date) {
  return format(date instanceof Date ? date : new Date(), LOCAL_FMT);
}

function fromLocalInput(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function LogEntryModal({ open, onClose, onSubmit, onDelete, tracker, initial, kidName }) {
  const { t } = useT();
  const [at, setAt] = useState(toLocalInput(new Date()));
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (!open) return;
    setAt(toLocalInput(initial?.at ?? new Date()));
    setValue(initial?.value == null ? '' : String(initial.value));
    setNote(initial?.note || '');
    setError('');
  }, [open, initial]);

  async function handleSubmit(e) {
    e.preventDefault();
    const when = fromLocalInput(at);
    if (!when) return setError(t('tracker.errTime'));
    setError('');
    setSaving(true);
    try {
      await onSubmit({ at: when, value, note });
    } catch (err) {
      setError(err.message || t('tracker.errSave'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!window.confirm(t('tracker.confirmDeleteEntry'))) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  const title = isEdit
    ? t('tracker.modalEditEntry')
    : t('tracker.modalNewEntry', { name: tracker?.name ?? '' });

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {kidName && (
          <p className="text-sm text-slate-500">{t('tracker.entryFor', { name: kidName })}</p>
        )}

        <Input
          label={t('tracker.whenLabel')}
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
          required
        />

        {tracker?.trackValue && (
          <Input
            label={
              tracker.unit
                ? t('tracker.valueLabelUnit', { unit: tracker.unit })
                : t('tracker.valueLabel')
            }
            type="number"
            step="any"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('tracker.valuePlaceholder')}
          />
        )}

        <Input
          label={t('tracker.noteLabel')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('tracker.notePlaceholder')}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          {isEdit && onDelete && (
            <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
              {t('common.delete')}
            </Button>
          )}
          <Button type="submit" loading={saving} className="ml-auto">
            {isEdit ? t('tracker.saveChanges') : t('tracker.saveEntry')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
