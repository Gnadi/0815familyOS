import { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import useT from '../../hooks/useT';

export default function GiftRecipientFormModal({ open, onClose, onSubmit, onDelete, initial }) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name || '');
    setBirthday(initial?.birthday || '');
    setError('');
  }, [open, initial]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setError(t('gifts.errRecipientName'));
    setError('');
    setSaving(true);
    try {
      await onSubmit({ name, birthday: birthday || null });
    } catch (err) {
      setError(err.message || t('gifts.errSaveRecipient'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    const ok = window.confirm(
      t('gifts.removePersonConfirm', { name: initial?.name || t('gifts.personFallback') })
    );
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
    <Modal open={open} onClose={onClose} title={isEdit ? t('gifts.modalEditRecipient') : t('gifts.newPerson')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('gifts.recipientName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('gifts.recipientNamePlaceholder')}
          required
          autoFocus
        />

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            {t('gifts.birthday')} <span className="font-normal text-slate-400">({t('common.optional')})</span>
          </span>
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          {isEdit && onDelete && (
            <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
              {t('common.delete')}
            </Button>
          )}
          <Button type="submit" loading={saving} className="ml-auto">
            {isEdit ? t('gifts.saveChanges') : t('gifts.addPersonBtn')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
