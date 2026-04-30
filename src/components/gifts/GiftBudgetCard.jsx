import { useState } from 'react';
import { Pencil, ShoppingBag, Wallet } from 'lucide-react';

export default function GiftBudgetCard({ budget, gifts, onBudgetSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const spent = gifts
    .filter((g) => g.status === 'bought' || g.status === 'gifted')
    .reduce((sum, g) => sum + g.price, 0);
  const remaining = Math.max(0, budget - spent);
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

  function startEdit() {
    setDraft(budget > 0 ? String(budget) : '');
    setEditing(true);
  }

  async function handleSave() {
    const val = parseFloat(draft);
    if (isNaN(val) || val < 0) return;
    setSaving(true);
    try {
      await onBudgetSave(val);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card space-y-4 dark:bg-slate-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Total Progress
        </span>
        <button
          onClick={startEdit}
          className="text-slate-400 hover:text-slate-600 transition dark:text-slate-500 dark:hover:text-slate-300"
          aria-label="Edit budget"
        >
          <Pencil size={14} />
        </button>
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">$</span>
          <input
            type="number"
            min={0}
            step={50}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-lg font-bold text-slate-900 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? '…' : 'Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-sm text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-slate-900 dark:text-white">
            ${spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-slate-400 dark:text-slate-500">
            / ${budget > 0 ? budget.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
          </span>
          {budget > 0 && (
            <span className="ml-auto text-sm font-semibold text-brand-600">{pct}%</span>
          )}
        </div>
      )}

      {!editing && budget > 0 && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {!editing && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-700">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300">
              <ShoppingBag size={16} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Spent</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                ${spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200 text-amber-700">
              <Wallet size={16} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Remaining</p>
              <p className="text-lg font-bold text-amber-700">
                ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
