import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import { RECIPE_CATEGORIES, DEFAULT_RECIPE_CATEGORY } from '../../constants/recipeCategories';

export default function RecipeFormModal({ open, onClose, onSubmit, onDelete, initial }) {
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [category, setCategory] = useState(DEFAULT_RECIPE_CATEGORY);
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
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
      setIngredients(initial.ingredients || '');
      setInstructions(initial.instructions || '');
      setNotes(initial.notes || '');
    } else {
      setTitle('');
      setSourceUrl('');
      setCategory(DEFAULT_RECIPE_CATEGORY);
      setIngredients('');
      setInstructions('');
      setNotes('');
    }
    setError('');
  }, [open, initial]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return setError('Please enter a recipe title.');
    setError('');
    setSaving(true);
    try {
      await onSubmit({ title, sourceUrl, category, ingredients, instructions, notes });
    } catch (err) {
      setError(err.message || 'Could not save recipe.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    const ok = window.confirm('Delete this recipe? This cannot be undone.');
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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Recipe' : 'New Recipe'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Grandma's Lasagna"
          required
          autoFocus
        />

        <div>
          <Input
            label="Link (optional)"
            type="url"
            inputMode="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="chefkoch.de/rezept/…"
          />
          {sourceUrl.trim() && (
            <a
              href={/^https?:\/\//i.test(sourceUrl.trim()) ? sourceUrl.trim() : `https://${sourceUrl.trim()}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
            >
              <ExternalLink size={14} /> Open link
            </a>
          )}
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Category</span>
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
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Ingredients <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <textarea
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            placeholder="One per line — 500g flour, 3 eggs…"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Instructions <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            placeholder="How to prepare it…"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Notes <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            placeholder="Serves 4, freezes well…"
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
            {isEdit ? 'Save Changes' : 'Add Recipe'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
