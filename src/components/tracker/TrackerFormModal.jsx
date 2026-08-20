import { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import useT from '../../hooks/useT';
import {
  TRACKER_COLOR_IDS,
  TRACKER_EMOJIS,
  TRACKER_PRESETS,
  trackerColor,
} from '../../constants/trackerPresets';

const EMPTY = {
  name: '',
  emoji: '⭐',
  color: 'brand',
  kidIds: [],
  unit: '',
  trackValue: false,
  dailyGoal: '',
  minIntervalHours: '',
};

function fromTracker(tracker) {
  return {
    name: tracker.name || '',
    emoji: tracker.emoji || '⭐',
    color: tracker.color || 'brand',
    kidIds: tracker.kidIds || [],
    unit: tracker.unit || '',
    trackValue: Boolean(tracker.trackValue),
    dailyGoal: tracker.dailyGoal == null ? '' : String(tracker.dailyGoal),
    minIntervalHours: tracker.minIntervalHours == null ? '' : String(tracker.minIntervalHours),
  };
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
      </span>
      <span
        className={`relative h-6 w-10 flex-shrink-0 rounded-full transition ${
          checked ? 'bg-brand-500' : 'bg-slate-200'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[1.125rem]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

export default function TrackerFormModal({ open, onClose, onSubmit, onDelete, initial, kids, defaultKidId }) {
  const { t } = useT();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (!open) return;
    setForm(
      isEdit
        ? fromTracker(initial)
        : { ...EMPTY, kidIds: defaultKidId ? [defaultKidId] : [] },
    );
    setError('');
  }, [open, initial, isEdit, defaultKidId]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function applyPreset(preset) {
    set({
      // The preset's label is a suggestion; anything already typed wins.
      name: form.name.trim() || t(preset.nameKey),
      emoji: preset.emoji,
      color: preset.color,
      unit: preset.unit,
      trackValue: preset.trackValue,
      dailyGoal: preset.dailyGoal == null ? '' : String(preset.dailyGoal),
      minIntervalHours: preset.minIntervalHours == null ? '' : String(preset.minIntervalHours),
    });
  }

  function toggleKid(kidId) {
    set({
      kidIds: form.kidIds.includes(kidId)
        ? form.kidIds.filter((id) => id !== kidId)
        : [...form.kidIds, kidId],
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError(t('tracker.errName'));
    if (form.kidIds.length === 0) return setError(t('tracker.errKid'));
    setError('');
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message || t('tracker.errSave'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!window.confirm(t('tracker.confirmDeleteTracker'))) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('tracker.modalEditTracker') : t('tracker.modalNewTracker')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEdit && (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              {t('tracker.presetsLabel')}
            </span>
            <div className="flex flex-wrap gap-2">
              {TRACKER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <span>{preset.emoji}</span>
                  {t(preset.nameKey)}
                </button>
              ))}
            </div>
          </div>
        )}

        <Input
          label={t('tracker.nameLabel')}
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder={t('tracker.namePlaceholder')}
          required
          autoFocus
        />

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('tracker.iconLabel')}</span>
          <div className="grid grid-cols-8 gap-1.5">
            {TRACKER_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => set({ emoji })}
                className={`flex h-9 items-center justify-center rounded-lg text-lg transition ${
                  form.emoji === emoji ? 'bg-brand-100 ring-2 ring-brand-400' : 'bg-slate-100 hover:bg-slate-200'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('tracker.colorLabel')}</span>
          <div className="flex gap-2">
            {TRACKER_COLOR_IDS.map((id) => (
              <button
                key={id}
                type="button"
                aria-label={id}
                onClick={() => set({ color: id })}
                className={`h-8 w-8 rounded-full ${trackerColor(id).dot} ${
                  form.color === id ? 'ring-2 ring-slate-900 ring-offset-2' : ''
                }`}
              />
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('tracker.kidsLabel')}</span>
          <div className="flex flex-wrap gap-2">
            {kids.map((kid) => (
              <button
                key={kid.id}
                type="button"
                onClick={() => toggleKid(kid.id)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  form.kidIds.includes(kid.id)
                    ? 'bg-brand-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {kid.name}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{t('tracker.kidsHint')}</p>
        </div>

        <Toggle
          label={t('tracker.trackValueLabel')}
          description={t('tracker.trackValueHint')}
          checked={form.trackValue}
          onChange={(v) => set({ trackValue: v })}
        />

        {form.trackValue && (
          <Input
            label={t('tracker.unitLabel')}
            value={form.unit}
            onChange={(e) => set({ unit: e.target.value })}
            placeholder={t('tracker.unitPlaceholder')}
          />
        )}

        <Input
          label={t('tracker.dailyGoalLabel')}
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={form.dailyGoal}
          onChange={(e) => set({ dailyGoal: e.target.value })}
          placeholder={t('tracker.dailyGoalPlaceholder')}
        />

        <Input
          label={t('tracker.intervalLabel')}
          type="number"
          min="0"
          step="0.5"
          inputMode="decimal"
          value={form.minIntervalHours}
          onChange={(e) => set({ minIntervalHours: e.target.value })}
          placeholder={t('tracker.intervalPlaceholder')}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          {isEdit && onDelete && (
            <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
              {t('common.delete')}
            </Button>
          )}
          <Button type="submit" loading={saving} className="ml-auto">
            {isEdit ? t('tracker.saveChanges') : t('tracker.createTracker')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
