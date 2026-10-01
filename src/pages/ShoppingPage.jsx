import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { addDays, isSameDay } from 'date-fns';
import { Plus, ShoppingBasket, BadgePercent, Footprints, Hourglass, CalendarCheck, Sparkles } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import ShoppingItemModal from '../components/shopping/ShoppingItemModal';
import SuggestionList from '../components/shopping/SuggestionList';
import WeeklyProposalModal from '../components/shopping/WeeklyProposalModal';
import useAuth from '../hooks/useAuth';
import useT from '../hooks/useT';
import useLongPress from '../hooks/useLongPress';
import useShoppingItems from '../hooks/useShoppingItems';
import useShoppingProducts from '../hooks/useShoppingProducts';
import useRecipes from '../hooks/useRecipes';
import useMealPlan from '../hooks/useMealPlan';
import { guessProductIcon } from '../utils/productIcons';
import { formatDate } from '../utils/date';
import { decimalSeparatorFor } from '../utils/ingredients';
import { householdPortions, normalizeHousehold } from '../utils/household';
import { ownPurchases, predictProduct, tripsOf } from '../utils/consumption';
import {
  CONTINUOUS_HORIZON_DAYS,
  indexShoppingItems,
  isFreshProduct,
  mealPlanLines,
  nextShoppingDate,
  planWeeklyProposal,
  plannedMeals,
  productKey,
  shoppingSuggestions,
  tripId,
} from '../utils/smartShopping';
import {
  addShoppingItemsBulk,
  checkOffShoppingItem,
  createShoppingItem,
  reopenShoppingItem,
} from '../services/shopping';
import { logProductWriteError, updateProductPreferences } from '../services/shoppingProducts';
import { markMealsShopped } from '../services/mealPlan';

export default function ShoppingPage() {
  const { user, userDoc, family } = useAuth();
  const { t, tn, locale } = useT();
  const familyId = userDoc?.familyId;
  const userId = user?.uid;
  const { items, loading } = useShoppingItems(familyId);
  const { products } = useShoppingProducts(familyId);
  const { setShoppingFabCallback } = useOutletContext() || {};
  const [title, setTitle] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [proposalOpen, setProposalOpen] = useState(false);
  const inputRef = useRef(null);

  const memberCount = family?.memberIds?.length || 1;
  const household = normalizeHousehold(family?.household, memberCount);
  const weekly = household.shoppingMode === 'weekly';

  // Only the weekly proposal needs recipes and the meal plan.
  const { recipes } = useRecipes(weekly ? familyId : null);
  const { entries: mealEntries } = useMealPlan(weekly ? familyId : null);

  const productsByKey = useMemo(() => new Map(products.map((p) => [p.key, p])), [products]);
  const itemIndex = useMemo(() => indexShoppingItems(items), [items]);
  const productFor = (itemTitle) => productsByKey.get(productKey(itemTitle)) || null;

  const toBuy = items.filter((i) => !i.done);
  const recent = items.filter((i) => i.done);
  const editingItem = items.find((i) => i.id === editingId) || null;

  // Where a new item waits in weekly mode: fresh food on the in-between list,
  // everything else on the weekly shop. The running list has one list only.
  const listFor = (itemTitle) => {
    if (!weekly) return undefined;
    return isFreshProduct(itemTitle, productFor(itemTitle)?.fresh) ? 'fresh' : 'main';
  };

  const tripDate = weekly ? nextShoppingDate(new Date(), household.shoppingDay) : null;
  const tripKey = tripDate?.getTime();

  const suggestions = useMemo(() => {
    const now = new Date();
    const until = weekly
      ? nextShoppingDate(now, household.shoppingDay)
      : addDays(now, CONTINUOUS_HORIZON_DAYS);
    return shoppingSuggestions({ products, items, now, until });
  }, [products, items, weekly, household.shoppingDay]);

  const portions = householdPortions({ household: family?.household, kids: family?.kids, memberCount }).total;
  // The weekly proposal covers the week the next shop is for. Meals already
  // shopped for are left out (and listed as such), so nothing is offered twice.
  const { proposal, meals } = useMemo(() => {
    if (!weekly || !tripKey) return { proposal: [], meals: [] };
    const from = new Date(tripKey);
    const to = addDays(from, 7);
    const mealLines = mealPlanLines({
      entries: mealEntries,
      recipes,
      from,
      to,
      portions,
      decimalSeparator: decimalSeparatorFor(locale),
      skipShopped: true,
    });
    return {
      proposal: planWeeklyProposal({ products, items, mealLines, tripDate: from, now: new Date() }),
      meals: plannedMeals({ entries: mealEntries, recipes, from, to }),
    };
  }, [weekly, tripKey, mealEntries, recipes, portions, locale, products, items]);
  const proposalCount = proposal.filter((p) => p.action !== 'skip').length;

  // Until something has a rhythm, say that the list is learning — otherwise
  // the smart part is invisible for the first weeks.
  const learning = useMemo(() => {
    const now = new Date();
    if (products.some((p) => ['predicted', 'dormant'].includes(predictProduct(p, now).status))) return null;
    return products.reduce((sum, p) => sum + tripsOf(ownPurchases(p.purchases)).length, 0);
  }, [products]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim() || !familyId || !userId) return;
    await createShoppingItem({
      familyId,
      userId,
      title,
      icon: guessProductIcon(title),
      list: listFor(title),
    });
    setTitle('');
  }

  function handleCheckOff(item) {
    return checkOffShoppingItem(item, { familyId, userId, products });
  }

  function handleReopen(item) {
    return reopenShoppingItem(item, { familyId, userId, products, list: listFor(item.title) });
  }

  // A suggestion brings back the product's "recently used" tile when there is
  // one (keeping its icon and flags), else creates the item. In weekly mode it
  // goes on the in-between list: it runs out before the weekly shop.
  function handleAddSuggestion(product) {
    const tile = itemIndex.doneByKey.get(product.key);
    const list = weekly ? 'fresh' : undefined;
    if (tile) return reopenShoppingItem(tile, { familyId, userId, products, list });
    return createShoppingItem({
      familyId,
      userId,
      title: product.title,
      icon: guessProductIcon(product.title),
      list,
    });
  }

  function handleStillHave(product) {
    updateProductPreferences({ familyId, userId, title: product.title, stillHave: true }).catch(
      logProductWriteError,
    );
  }

  // Confirming plans the shop for every meal of the week that was still open,
  // so they are not offered again, and tags the items with the trip, so what
  // was bought for it is not offered again for the same trip either.
  async function handleConfirmProposal(chosen) {
    await Promise.all([
      addShoppingItemsBulk({
        familyId,
        userId,
        plan: chosen,
        items,
        products,
        list: 'main',
        proposedFor: tripId(new Date(tripKey)),
      }),
      markMealsShopped(meals.filter((m) => !m.shopped).map((m) => m.entry)),
    ]);
    setProposalOpen(false);
  }

  const iconFor = (product) => itemIndex.doneByKey.get(product.key)?.icon || '';

  const dayLabel = (date) => {
    const today = new Date();
    if (isSameDay(date, today)) return t('common.today');
    if (isSameDay(date, addDays(today, 1))) return t('common.tomorrow');
    return formatDate(date, 'weekdayShort');
  };

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

  const sectionProps = { onEdit: (item) => setEditingId(item.id), t };

  return (
    <>
      <TopBar title={t('shopping.title')} />
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
        ) : (
          <>
            {weekly && tripDate && (
              <section className="rounded-2xl bg-white p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-600">
                    <CalendarCheck size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">
                      {t('shopping.nextShop', { day: dayLabel(tripDate) })}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {proposalCount > 0 ? tn('shopping.proposalCount', proposalCount) : t('shopping.proposalNone')}
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setProposalOpen(true)}
                  className="mt-3 w-full rounded-full bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
                >
                  {t('shopping.viewProposal')}
                </button>
              </section>
            )}

            <SuggestionList
              title={weekly ? t('shopping.untilShop') : t('shopping.dueSoon')}
              hint={weekly ? t('shopping.untilShopHint') : null}
              suggestions={suggestions}
              iconFor={iconFor}
              onAdd={handleAddSuggestion}
              onStillHave={handleStillHave}
            />

            {learning !== null && (
              <section className="flex gap-3 rounded-2xl border border-dashed border-slate-200 p-4">
                <Sparkles size={18} className="mt-0.5 shrink-0 text-brand-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">{t('shopping.learningTitle')}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                    {learning > 0 ? tn('shopping.learningProgress', learning) : t('shopping.learningStart')}
                  </p>
                </div>
              </section>
            )}

            {items.length === 0 ? (
              <EmptyState
                icon={ShoppingBasket}
                title={t('shopping.emptyTitle')}
                description={t('shopping.emptyDesc')}
              />
            ) : (
              <>
                {weekly ? (
                  <>
                    <Section
                      title={t('shopping.weeklyShop')}
                      items={toBuy.filter((i) => i.list !== 'fresh')}
                      empty={t('shopping.allChecked')}
                      variant="buy"
                      onToggle={handleCheckOff}
                      {...sectionProps}
                    />
                    <Section
                      title={t('shopping.inBetween')}
                      items={toBuy.filter((i) => i.list === 'fresh')}
                      empty={t('shopping.inBetweenEmpty')}
                      variant="buy"
                      onToggle={handleCheckOff}
                      {...sectionProps}
                    />
                  </>
                ) : (
                  <Section
                    title={t('shopping.toBuy')}
                    items={toBuy}
                    empty={t('shopping.allChecked')}
                    variant="buy"
                    onToggle={handleCheckOff}
                    {...sectionProps}
                  />
                )}

                {recent.length > 0 && (
                  <Section
                    title={t('shopping.recentlyUsed')}
                    items={recent}
                    variant="recent"
                    onToggle={handleReopen}
                    {...sectionProps}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>

      <ShoppingItemModal
        item={editingItem}
        product={editingItem ? productFor(editingItem.title) : null}
        weekly={weekly}
        familyId={familyId}
        userId={userId}
        onClose={() => setEditingId(null)}
      />

      {weekly && tripDate && (
        <WeeklyProposalModal
          open={proposalOpen}
          onClose={() => setProposalOpen(false)}
          title={t('shopping.proposalTitle', { day: dayLabel(tripDate) })}
          plan={proposal}
          meals={meals}
          recipeCount={recipes.length}
          onConfirm={handleConfirmProposal}
        />
      )}
    </>
  );
}

function Section({ title, empty, items, variant, onToggle, onEdit, t }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
          {items.length}
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
