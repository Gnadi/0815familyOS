import { useEffect, useState } from 'react';
import { ExternalLink, Plus, X } from 'lucide-react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import { RECIPE_CATEGORIES, DEFAULT_RECIPE_CATEGORY } from '../../constants/recipeCategories';
import useT from '../../hooks/useT';
import { tLabel } from '../../i18n/labels';

// A dynamic list always shows at least one (empty) row so there's somewhere
// to type; empty rows are stripped on submit.
function seedRows(list) {
  return list && list.length > 0 ? list : [''];
}

export default function RecipeFormModal({ open, onClose, onSubmit, onDelete, initial }) {
  const { t } = useT();
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [category, setCategory] = useState(DEFAULT_RECIPE_CATEGORY);
  const [ingredients, setIngredients] = useState(['']);
  const [steps, setSteps] = useState(['']);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title || '');
      setSourceUrl(initial.sourceUrl || '');
      setCategory(initial.category || DEFAULT_RECIPE_CATEGORY);
      setIngredients(seedRows(initial.ingredients));
      setSteps(seedRows(initial.instructions));
      setNotes(initial.notes || '');
    } else {
      setTitle('');
      setSourceUrl('');
      setCategory(DEFAULT_RECIPE_CATEGORY);
      setIngredients(['']);
      setSteps(['']);
      setNotes('');
    }
    setError('');
  }, [open, initial]);

  // Helpers to edit one row, drop a row, or append a new empty row of a list.
  const updateRow = (setList) => (i, value) =>
    setList((list) => list.map((v, idx) => (idx === i ? value : v)));
  const removeRow = (setList) => (i) =>
    setList((list) => (list.length > 1 ? list.filter((_, idx) => idx !== i) : ['']));
  const addRow = (setList) => () => setList((list) => [...list, '']);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return setError(t('food.errRecipeTitle'));
    setError('');
    setSaving(true);
    try {
      await onSubmit({
        title,
        sourceUrl,
        category,
        ingredients: ingredients.map((s) => s.trim()).filter(Boolean),
        instructions: steps.map((s) => s.trim()).filter(Boolean),
        notes,
      });
    } catch (err) {
      setError(err.message || t('food.errSaveRecipe'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    const ok = window.confirm(t('food.confirmDeleteRecipe'));
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
    <Modal open={open} onClose={onClose} title={isEdit ? t('food.modalEditRecipe') : t('food.modalNewRecipe')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('food.recipeTitleLabel')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('food.recipeTitlePlaceholder')}
          required
          autoFocus
        />

        <div>
          <Input
            label={t('food.linkOptional')}
            type="url"
            inputMode="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder={t('food.linkPlaceholder')}
          />
          {sourceUrl.trim() && (
            <a
              href={/^https?:\/\//i.test(sourceUrl.trim()) ? sourceUrl.trim() : `https://${sourceUrl.trim()}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
            >
              <ExternalLink size={14} /> {t('food.openLink')}
            </a>
          )}
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('food.category')}</span>
          <div className="flex flex-wrap gap-2">
            {RECIPE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  category === c.id
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tLabel(t, c)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            {t('food.ingredients')} <span className="font-normal text-slate-400">({t('common.optional')})</span>
          </span>
          <div className="space-y-2">
            {ingredients.map((value, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={value}
                  onChange={(e) => updateRow(setIngredients)(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addRow(setIngredients)();
                    }
                  }}
                  placeholder={t('food.ingredientPlaceholder', { n: i + 1 })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-base text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
                <button
                  type="button"
                  onClick={() => removeRow(setIngredients)(i)}
                  aria-label={t('food.removeIngredient', { n: i + 1 })}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => addRow(setIngredients)()}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
          >
            <Plus size={16} /> {t('food.addIngredient')}
          </button>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            {t('food.steps')} <span className="font-normal text-slate-400">({t('common.optional')})</span>
          </span>
          <div className="space-y-2">
            {steps.map((value, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">
                  {i + 1}
                </span>
                <textarea
                  value={value}
                  onChange={(e) => updateRow(setSteps)(i, e.target.value)}
                  rows={2}
                  placeholder={t('food.stepPlaceholder', { n: i + 1 })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-base text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
                <button
                  type="button"
                  onClick={() => removeRow(setSteps)(i)}
                  aria-label={t('food.removeStep', { n: i + 1 })}
                  className="mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => addRow(setSteps)()}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
          >
            <Plus size={16} /> {t('food.addStep')}
          </button>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            {t('food.notes')} <span className="font-normal text-slate-400">({t('common.optional')})</span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            placeholder={t('food.notesPlaceholder')}
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
            {isEdit ? t('food.saveChanges') : t('food.addRecipe')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
