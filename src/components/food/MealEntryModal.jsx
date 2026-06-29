import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { UserPlus, X } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { getSlotLabelKey } from '../../constants/mealSlots';
import useT from '../../hooks/useT';

// Modal for one cell of the week plan (a given day + slot). A meal is either a
// reference to a saved recipe or a piece of free text ("Order pizza"), with an
// optional cook (a family member or an external person).
export default function MealEntryModal({
  open,
  onClose,
  onSubmit,
  onDelete,
  cell,
  entry,
  recipes,
  members = [],
  cooks = [],
  onAddCook,
  onRemoveCook,
}) {
  const { t } = useT();
  const [mode, setMode] = useState('recipe'); // 'recipe' | 'text'
  const [recipeId, setRecipeId] = useState('');
  const [text, setText] = useState('');
  const [cook, setCook] = useState(null); // { id, type, name } | null
  const [newCookName, setNewCookName] = useState('');
  const [addingCook, setAddingCook] = useState(false);
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
      if (entry.cookId) {
        const name =
          entry.cookType === 'member'
            ? members.find((m) => m.uid === entry.cookId)?.displayName
            : cooks.find((c) => c.id === entry.cookId)?.name;
        setCook({ id: entry.cookId, type: entry.cookType, name: name || entry.cookName || '' });
      } else {
        setCook(null);
      }
    } else {
      setMode(recipes.length > 0 ? 'recipe' : 'text');
      setRecipeId('');
      setText('');
      setCook(null);
    }
    setNewCookName('');
    setError('');
  }, [open, entry, recipes.length, members, cooks]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (mode === 'recipe' && !recipeId) return setError(t('food.errPickRecipe'));
    if (mode === 'text' && !text.trim()) return setError(t('food.errEnterMeal'));
    setError('');
    setSaving(true);
    try {
      await onSubmit({
        ...(mode === 'recipe' ? { recipeId, text: '' } : { recipeId: null, text }),
        cookId: cook?.id || null,
        cookType: cook?.type || null,
        cookName: cook?.name || '',
      });
    } catch (err) {
      setError(err.message || t('food.errSave'));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCook() {
    const name = newCookName.trim();
    if (!name || !onAddCook) return;
    setAddingCook(true);
    try {
      const created = await onAddCook(name);
      if (created) setCook({ id: created.id, type: 'external', name: created.name });
      setNewCookName('');
    } catch (err) {
      setError(err.message || t('food.errAddPerson'));
    } finally {
      setAddingCook(false);
    }
  }

  async function handleRemoveCook(c) {
    if (!onRemoveCook) return;
    const ok = window.confirm(t('food.removeCookConfirm', { name: c.name }));
    if (!ok) return;
    if (cook?.id === c.id && cook?.type === 'external') setCook(null);
    try {
      await onRemoveCook(c);
    } catch (err) {
      setError(err.message || t('food.errRemovePerson'));
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
    ? `${t(getSlotLabelKey(cell.slot) || 'food.meal')} · ${format(cell.date, 'EEE, MMM d')}`
    : t('food.planMeal');
  const isEdit = Boolean(entry);

  const isSelected = (id, type) => cook?.id === id && cook?.type === type;
  const chip = (active) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium transition ${
      active
        ? 'border-brand-500 bg-brand-500 text-white'
        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
    }`;

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex rounded-xl bg-slate-100 p-1">
          {[
            { id: 'recipe', label: t('food.fromRecipe') },
            { id: 'text', label: t('food.freeText') },
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
              {t('food.noRecipesSwitch')}
            </p>
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('food.recipe')}</span>
              <select
                value={recipeId}
                onChange={(e) => setRecipeId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                <option value="">{t('food.selectRecipe')}</option>
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
            <span className="mb-1.5 block text-sm font-medium text-slate-700">{t('food.meal')}</span>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('food.mealPlaceholder')}
              autoFocus
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        )}

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            {t('food.cook')} <span className="font-normal text-slate-400">({t('common.optional')})</span>
          </span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setCook(null)} className={chip(!cook)}>
              {t('common.none')}
            </button>
            {members.map((m) => (
              <button
                key={m.uid}
                type="button"
                onClick={() => setCook({ id: m.uid, type: 'member', name: m.displayName })}
                className={chip(isSelected(m.uid, 'member'))}
              >
                {m.displayName}
              </button>
            ))}
            {cooks.map((c) => {
              const active = isSelected(c.id, 'external');
              return (
                <span
                  key={c.id}
                  className={`inline-flex items-center gap-1 rounded-full border py-1.5 pl-3 pr-1.5 text-sm font-medium transition ${
                    active
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setCook({ id: c.id, type: 'external', name: c.name })}
                  >
                    {c.name}
                  </button>
                  {onRemoveCook && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCook(c)}
                      aria-label={t('food.removeName', { name: c.name })}
                      className={`flex h-4 w-4 items-center justify-center rounded-full ${
                        active ? 'hover:bg-white/25' : 'text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              );
            })}
          </div>

          {onAddCook && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newCookName}
                onChange={(e) => setNewCookName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCook();
                  }
                }}
                placeholder={t('food.addAnotherPerson')}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <button
                type="button"
                onClick={handleAddCook}
                disabled={!newCookName.trim() || addingCook}
                aria-label={t('food.addPerson')}
                className="flex items-center justify-center rounded-xl bg-slate-100 px-3 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
              >
                <UserPlus size={16} />
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          {isEdit && onDelete && (
            <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
              {t('common.remove')}
            </Button>
          )}
          <Button type="submit" loading={saving} className="ml-auto">
            {isEdit ? t('common.save') : t('food.addToPlan')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
