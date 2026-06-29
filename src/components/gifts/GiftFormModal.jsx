import { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import useT from '../../hooks/useT';

const STATUSES = [
  { id: 'idea',   labelKey: 'gifts.statusIdea' },
  { id: 'bought', labelKey: 'gifts.statusBought' },
  { id: 'gifted', labelKey: 'gifts.statusGifted' },
];

const STATUS_ACTIVE = {
  idea:   'bg-white text-slate-700 shadow-sm',
  bought: 'bg-white text-blue-700 shadow-sm',
  gifted: 'bg-white text-emerald-700 shadow-sm',
};

export default function GiftFormModal({ open, onClose, onSubmit, onDelete, initial, recipients }) {
  const { t } = useT();
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
      setKidId(recipients[0]?.id || '');
      setPrice('');
      setStatus('idea');
      setNotes('');
    }
    setError('');
  }, [open, initial, recipients]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return setError(t('gifts.errGiftTitle'));
    if (!kidId) return setError(t('gifts.errRecipient'));
    setError('');
    setSaving(true);
    try {
      await onSubmit({ title, kidId, price: parseFloat(price) || 0, status, notes });
    } catch (err) {
      setError(err.message || t('gifts.errSaveGift'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    const ok = window.confirm(t('gifts.confirmDeleteGift'));
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
    <Modal open={open} onClose={onClose} title={isEdit ? t('gifts.modalEditTitle') : t('gifts.modalNewTitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('gifts.giftTitleLabel')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('gifts.giftTitlePlaceholder')}
          required
          autoFocus
        />

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('gifts.forWhom')}</span>
          {recipients.length === 0 ? (
            <p className="text-sm text-slate-400">
              {t('gifts.noRecipientsInline')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {recipients.map((recipient) => (
                <button
                  key={recipient.id}
                  type="button"
                  onClick={() => setKidId(recipient.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    kidId === recipient.id
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {recipient.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            {t('gifts.price')} <span className="font-normal text-slate-400">({t('common.optional')})</span>
          </span>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-8 pr-4 text-base text-slate-900 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('gifts.status')}</span>
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

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            {t('gifts.notes')} <span className="font-normal text-slate-400">({t('common.optional')})</span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            placeholder={t('gifts.notesPlaceholder')}
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
            {isEdit ? t('gifts.saveChanges') : t('gifts.addGiftBtn')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
