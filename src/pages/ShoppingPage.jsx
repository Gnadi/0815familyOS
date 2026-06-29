import { useState } from 'react';
import { Plus, ShoppingBasket, Trash2 } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import useAuth from '../hooks/useAuth';
import useT from '../hooks/useT';
import useShoppingItems from '../hooks/useShoppingItems';
import {
  clearCompletedShoppingItems,
  createShoppingItem,
  deleteShoppingItem,
  setShoppingItemDone,
} from '../services/shopping';

export default function ShoppingPage() {
  const { user, userDoc } = useAuth();
  const { t } = useT();
  const { items, loading } = useShoppingItems(userDoc?.familyId);
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');

  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim() || !userDoc?.familyId || !user?.uid) return;
    await createShoppingItem({
      familyId: userDoc.familyId,
      userId: user.uid,
      title,
      quantity,
    });
    setTitle('');
    setQuantity('');
  }

  return (
    <>
      <TopBar title={t('shopping.title')} showBell={false} />
      <main className="mx-auto max-w-md space-y-5 px-5 py-5">
        <form onSubmit={handleAdd} className="flex gap-2 rounded-2xl bg-white p-3 shadow-card">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('shopping.whatNeed')}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            autoFocus
          />
          <input
            type="text"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={t('shopping.qtyPlaceholder')}
            className="w-16 rounded-xl border border-slate-200 bg-white px-2 py-2 text-center text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            aria-label={t('shopping.addItem')}
            className="flex items-center justify-center rounded-xl bg-brand-500 px-3 text-white shadow-sm hover:bg-brand-600 disabled:opacity-40"
          >
            <Plus size={18} />
          </button>
        </form>

        {loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState
            icon={ShoppingBasket}
            title={t('shopping.emptyTitle')}
            description={t('shopping.emptyDesc')}
          />
        ) : (
          <>
            <section className="space-y-2">
              {open.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
                  {t('shopping.allChecked')}
                </p>
              ) : (
                open.map((item) => (
                  <ShoppingRow key={item.id} item={item} t={t} />
                ))
              )}
            </section>

            {done.length > 0 && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t('shopping.doneCount', { count: done.length })}
                  </h2>
                  <button
                    type="button"
                    onClick={() => clearCompletedShoppingItems(userDoc.familyId)}
                    className="text-xs font-semibold text-slate-500 hover:text-red-600"
                  >
                    {t('shopping.clearAll')}
                  </button>
                </div>
                <div className="space-y-2">
                  {done.map((item) => (
                    <ShoppingRow key={item.id} item={item} t={t} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}

function ShoppingRow({ item, t }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card">
      <input
        type="checkbox"
        checked={item.done}
        onChange={(e) => setShoppingItemDone(item.id, e.target.checked)}
        className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        aria-label={item.done ? t('shopping.markNotDone') : t('shopping.markDone')}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${item.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
          {item.title}
        </p>
        {item.quantity && (
          <p className="text-xs text-slate-500">{item.quantity}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => deleteShoppingItem(item.id)}
        aria-label={t('shopping.deleteItem')}
        className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
