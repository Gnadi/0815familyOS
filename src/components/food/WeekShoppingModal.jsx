import { useEffect, useMemo, useState } from 'react';
import { ShoppingBasket } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import useT from '../../hooks/useT';
import { planShoppingAdditions } from '../../services/shopping';

// Review step for putting a whole week's ingredients on the shopping list.
//
// Deliberately not a silent bulk write: a week is up to 21 slots of roughly
// ten ingredients each, and dumping eighty rows into a list the whole family
// shares — with no undo anywhere in the app — is destructive. Everything that
// is already on the list comes pre-unchecked and labelled, so the default
// action only adds what is genuinely missing.
export default function WeekShoppingModal({ open, onClose, lines, shoppingItems, onConfirm }) {
  const { t, tn } = useT();
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const plan = useMemo(
    () => (open ? planShoppingAdditions({ lines, existingItems: shoppingItems }) : []),
    [open, lines, shoppingItems],
  );

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(plan.filter((p) => p.action !== 'skip').map((p) => p.key)));
    setError('');
  }, [open, plan]);

  const selectable = plan.filter((p) => p.action !== 'skip');
  const allSelected = selectable.length > 0 && selectable.every((p) => selected.has(p.key));

  function toggle(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable.map((p) => p.key)));
  }

  async function handleConfirm() {
    setError('');
    setBusy(true);
    try {
      await onConfirm(plan.filter((p) => selected.has(p.key)));
    } catch (err) {
      setError(err.message || t('food.errAddToShopping'));
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  const chosen = plan.filter((p) => selected.has(p.key)).length;

  return (
    <Modal open={open} onClose={onClose} title={t('food.weekShoppingTitle')}>
      {plan.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">{t('food.weekShoppingEmpty')}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{t('food.weekShoppingSubtitle')}</p>
            {selectable.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="shrink-0 text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                {allSelected ? t('food.selectNone') : t('food.selectAll')}
              </button>
            )}
          </div>

          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {plan.map((entry) => {
              const already = entry.action === 'skip';
              return (
                <li key={entry.key}>
                  <label
                    className={`flex items-center gap-3 px-3 py-2.5 ${
                      already ? 'opacity-60' : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(entry.key)}
                      onChange={() => toggle(entry.key)}
                      disabled={already}
                      className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {entry.title}
                        {entry.count > 1 && (
                          <span className="ml-1.5 text-xs font-semibold text-slate-400">
                            {t('food.timesCount', { count: entry.count })}
                          </span>
                        )}
                      </span>
                      {entry.quantity && (
                        <span className="block truncate text-xs text-slate-500">
                          {entry.quantity}
                        </span>
                      )}
                    </span>
                    {already && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        {t('shopping.alreadyOnList')}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleConfirm} loading={busy} disabled={chosen === 0} className="w-full">
            <ShoppingBasket size={16} />
            {tn('food.addNItems', chosen)}
          </Button>
        </div>
      )}
    </Modal>
  );
}
