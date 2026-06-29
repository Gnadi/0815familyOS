import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, ShoppingBasket, BadgePercent, Footprints, Hourglass } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import ShoppingItemModal from '../components/shopping/ShoppingItemModal';
import useAuth from '../hooks/useAuth';
import useT from '../hooks/useT';
import useLongPress from '../hooks/useLongPress';
import useShoppingItems from '../hooks/useShoppingItems';
import { guessProductIcon } from '../utils/productIcons';
import {
  createShoppingItem,
  setShoppingItemDone,
} from '../services/shopping';

export default function ShoppingPage() {
  const { user, userDoc } = useAuth();
  const { t } = useT();
  const { items, loading } = useShoppingItems(userDoc?.familyId);
  const { setShoppingFabCallback } = useOutletContext() || {};
  const [title, setTitle] = useState('');
  const [editingId, setEditingId] = useState(null);
  const inputRef = useRef(null);

  const toBuy = items.filter((i) => !i.done);
  const recent = items.filter((i) => i.done);
  const editingItem = items.find((i) => i.id === editingId) || null;

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim() || !userDoc?.familyId || !user?.uid) return;
    await createShoppingItem({
      familyId: userDoc.familyId,
      userId: user.uid,
      title,
      icon: guessProductIcon(title),
    });
    setTitle('');
  }

  // Wire the shared "+" in the nav bar to this page's add field so it adds a
  // grocery rather than opening the event form.
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);
  useEffect(() => {
    setShoppingFabCallback?.(() => focusInput);
    return () => setShoppingFabCallback?.(null);
  }, [setShoppingFabCallback, focusInput]);

  return (
    <>
      <TopBar title={t('shopping.title')} showBell={false} />
      <main className="mx-auto max-w-md space-y-6 px-5 pt-5">
        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('shopping.whatNeed')}
            className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 shadow-card focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            aria-label={t('shopping.addItem')}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm hover:bg-brand-600 disabled:opacity-40"
          >
            <Plus size={22} />
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
            <Section
              title={t('shopping.toBuy')}
              count={toBuy.length}
              empty={t('shopping.allChecked')}
              items={toBuy}
              variant="buy"
              onToggle={(item) => setShoppingItemDone(item.id, true)}
              onEdit={(item) => setEditingId(item.id)}
              t={t}
            />

            {recent.length > 0 && (
              <Section
                title={t('shopping.recentlyUsed')}
                count={recent.length}
                items={recent}
                variant="recent"
                onToggle={(item) => setShoppingItemDone(item.id, false)}
                onEdit={(item) => setEditingId(item.id)}
                t={t}
              />
            )}
          </>
        )}
      </main>

      <ShoppingItemModal item={editingItem} onClose={() => setEditingId(null)} />
    </>
  );
}

function Section({ title, count, empty, items, variant, onToggle, onEdit, t }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
          {count}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
          {empty}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {items.map((item) => (
            <ProductTile
              key={item.id}
              item={item}
              variant={variant}
              onToggle={onToggle}
              onEdit={onEdit}
              t={t}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ProductTile({ item, variant, onToggle, onEdit, t }) {
  const handlers = useLongPress(
    () => onEdit(item),
    () => onToggle(item),
  );

  const icon = item.icon || guessProductIcon(item.title);
  const isBuy = variant === 'buy';

  return (
    <button
      type="button"
      {...handlers}
      title={t('shopping.tileHint')}
      className={`relative flex aspect-square select-none flex-col items-center justify-center gap-1.5 rounded-2xl p-2 text-center shadow-card transition-transform active:scale-95 ${
        isBuy
          ? 'bg-rose-400 text-white hover:bg-rose-500'
          : 'bg-teal-400 text-white hover:bg-teal-500'
      }`}
    >
      {/* Priority badges, top-right */}
      {(item.urgent || item.offer || item.ifConvenient) && (
        <span className="absolute right-1.5 top-1.5 flex gap-1">
          {item.urgent && <Footprints size={14} className="drop-shadow" />}
          {item.offer && <BadgePercent size={14} className="drop-shadow" />}
          {item.ifConvenient && <Hourglass size={14} className="drop-shadow" />}
        </span>
      )}
      <span className="text-3xl leading-none">{icon}</span>
      <span className="line-clamp-2 text-xs font-semibold leading-tight">{item.title}</span>
      {item.quantity && <span className="text-[11px] font-medium opacity-90">{item.quantity}</span>}
    </button>
  );
}
