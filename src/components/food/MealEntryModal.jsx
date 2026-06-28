import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { getSlotLabel } from '../../constants/mealSlots';

// Modal for one cell of the week plan (a given day + slot). A meal is either a
// reference to a saved recipe or a piece of free text ("Order pizza").
export default function MealEntryModal({ open, onClose, onSubmit, onDelete, cell, entry, recipes }) {
  const [mode, setMode] = useState('recipe'); // 'recipe' | 'text'
  const [recipeId, setRecipeId] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (entry) {
      if (entry.recipeId) {
        setMode('recipe');
        setRecipeId(entry.recipeId);
        setText('');
      } else {
        setMode('text');
        setRecipeId('');
        setText(entry.text || '');
      }
    } else {
      setMode(recipes.length > 0 ? 'recipe' : 'text');
      setRecipeId('');
      setText('');
    }
    setError('');
  }, [open, entry, recipes.length]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (mode === 'recipe' && !recipeId) return setError('Please pick a recipe.');
    if (mode === 'text' && !text.trim()) return setError('Please enter a meal.');
    setError('');
    setSaving(true);
    try {
      await onSubmit(
        mode === 'recipe' ? { recipeId, text: '' } : { recipeId: null, text },
      );
    } catch (err) {
      setError(err.message || 'Could not save.');
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

  const title = cell
    ? `${getSlotLabel(cell.slot)} · ${format(cell.date, 'EEE, MMM d')}`
    : 'Plan meal';
  const isEdit = Boolean(entry);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex rounded-xl bg-slate-100 p-1">
          {[
            { id: 'recipe', label: 'From recipe' },
            { id: 'text', label: 'Free text' },
          ].map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setMode(o.id)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                mode === o.id ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {mode === 'recipe' ? (
          recipes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
              No recipes yet. Add some in the Recipes tab, or switch to free text.
            </p>
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Recipe</span>
              <select
                value={recipeId}
                onChange={(e) => setRecipeId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                <option value="">Select a recipe…</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
          )
        ) : (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Meal</span>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Order pizza, Leftovers…"
              autoFocus
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          {isEdit && onDelete && (
            <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
              Remove
            </Button>
          )}
          <Button type="submit" loading={saving} className="ml-auto">
            {isEdit ? 'Save' : 'Add to plan'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
