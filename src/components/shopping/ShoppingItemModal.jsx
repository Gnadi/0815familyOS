import { useEffect, useState } from 'react';
import { Footprints, BadgePercent, Hourglass, Image as ImageIcon, Trash2, Leaf, BellOff, Sparkles } from 'lucide-react';
import Modal from '../common/Modal';
import useT from '../../hooks/useT';
import { PRODUCT_ICONS, guessProductIcon } from '../../utils/productIcons';
import { deleteShoppingItem, updateShoppingItem } from '../../services/shopping';
import { logProductWriteError, updateProductPreferences } from '../../services/shoppingProducts';
import { predictProduct } from '../../utils/consumption';
import { isFreshProduct } from '../../utils/smartShopping';
import { rhythmText } from './rhythmText';

// `product` is what the smart list has learned about this item (may be null
// before the first purchase); `weekly` enables the in-between list switch.
export default function ShoppingItemModal({ item, product, weekly, familyId, userId, onClose }) {
  const { t, tn } = useT();
  const [quantity, setQuantity] = useState('');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  // Reset local form state whenever a different item is opened.
  useEffect(() => {
    setQuantity(item?.quantity || '');
    setIconPickerOpen(false);
  }, [item?.id]);

  if (!item) return null;

  const icon = item.icon || guessProductIcon(item.title);

  function commitQuantity() {
    if ((item.quantity || '') !== quantity.trim()) {
      updateShoppingItem(item.id, { quantity });
    }
  }

  function toggleFlag(flag) {
    updateShoppingItem(item.id, { [flag]: !item[flag] });
  }

  function pickIcon(value) {
    updateShoppingItem(item.id, { icon: value });
    setIconPickerOpen(false);
  }

  // An open item shows the list it waits on; a "recently used" tile shows the
  // list it would go back to (ShoppingPage's listFor).
  const onFreshList = item.done ? isFreshProduct(item.title, product?.fresh) : item.list === 'fresh';

  // Moving an item to or from the in-between list also teaches the product
  // where it belongs, so the next time it is added it lands there by itself.
  function toggleFresh() {
    const fresh = !onFreshList;
    updateShoppingItem(item.id, { list: fresh ? 'fresh' : 'main' });
    updateProductPreferences({ familyId, userId, title: item.title, fresh }).catch(logProductWriteError);
  }

  function toggleMuted() {
    updateProductPreferences({ familyId, userId, title: item.title, muted: !product?.muted }).catch(
      logProductWriteError,
    );
  }

  const prediction = predictProduct(product);
  let learned;
  if (prediction.status === 'predicted' || prediction.status === 'dormant') {
    learned = rhythmText(prediction, { t, tn });
  } else if (prediction.status === 'irregular') {
    learned = t('shopping.learnedIrregular');
  } else if (prediction.trips > 0) {
    learned = tn('shopping.learnedLearning', prediction.trips);
  } else if (product?.purchases?.some((p) => p.planned)) {
    learned = t('shopping.learnedPlannedOnly');
  } else {
    learned = t('shopping.learnedNone');
  }

  const toggles = [
    weekly && {
      key: 'fresh',
      label: t('shopping.listFresh'),
      desc: t('shopping.listFreshDesc'),
      icon: Leaf,
      active: onFreshList,
      onClick: toggleFresh,
    },
    {
      key: 'muted',
      label: t('shopping.muteSuggestions'),
      desc: t('shopping.muteSuggestionsDesc'),
      icon: BellOff,
      active: Boolean(product?.muted),
      onClick: toggleMuted,
    },
  ].filter(Boolean);

  async function handleDelete() {
    await deleteShoppingItem(item.id);
    onClose();
  }

  const flags = [
    { key: 'urgent', label: t('shopping.urgent'), icon: Footprints },
    { key: 'offer', label: t('shopping.offer'), icon: BadgePercent },
    { key: 'ifConvenient', label: t('shopping.ifConvenient'), icon: Hourglass },
  ];

  return (
    <Modal
      open={!!item}
      onClose={() => {
        commitQuantity();
        onClose();
      }}
      title={item.title}
      footer={
        <button
          type="button"
          onClick={handleDelete}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 py-3.5 text-base font-semibold text-white hover:bg-red-600"
        >
          <Trash2 size={18} />
          {t('shopping.deleteItem')}
        </button>
      }
    >
      <div className="space-y-6">
        <input
          type="text"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onBlur={commitQuantity}
          placeholder={t('shopping.qtyDescription')}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-hidden focus:ring-2 focus:ring-brand-100"
        />

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            {t('shopping.itemDetailsFor', { name: item.title })}
          </h3>
          <div className="flex flex-wrap gap-2">
            {flags.map(({ key, label, icon: Icon }) => {
              const active = item[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleFlag(key)}
                  className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-brand-500 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  aria-pressed={active}
                >
                  <Icon size={16} />
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Sparkles size={15} className="text-brand-500" /> {t('shopping.learned')}
          </h3>
          <p className="mb-3 text-sm text-slate-600">{learned}</p>
          <div className="space-y-2">
            {toggles.map(({ key, label, desc, icon: Icon, active, onClick }) => (
              <button
                key={key}
                type="button"
                onClick={onClick}
                aria-pressed={active}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left transition-colors ${
                  active ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon size={16} className="shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className={`block text-xs ${active ? 'text-white/80' : 'text-slate-500'}`}>{desc}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">{t('shopping.settings')}</h3>
          <button
            type="button"
            onClick={() => setIconPickerOpen((v) => !v)}
            className="flex w-full flex-col items-center gap-2 rounded-2xl bg-slate-100 py-5 text-slate-700 hover:bg-slate-200"
          >
            <span className="text-3xl leading-none">{icon}</span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <ImageIcon size={16} />
              {t('shopping.changeIcon')}
            </span>
          </button>

          {iconPickerOpen && (
            <div className="mt-3 grid grid-cols-8 gap-2 rounded-2xl border border-slate-200 p-3">
              {PRODUCT_ICONS.map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  type="button"
                  onClick={() => pickIcon(emoji)}
                  className={`flex aspect-square items-center justify-center rounded-xl text-xl hover:bg-slate-100 ${
                    icon === emoji ? 'bg-brand-100 ring-2 ring-brand-400' : ''
                  }`}
                  aria-label={t('shopping.changeIcon')}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
