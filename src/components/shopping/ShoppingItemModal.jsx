import { useEffect, useState } from 'react';
import { Footprints, BadgePercent, Hourglass, Image as ImageIcon, Trash2 } from 'lucide-react';
import Modal from '../common/Modal';
import useT from '../../hooks/useT';
import { PRODUCT_ICONS, guessProductIcon, productInitial, LETTER_ICON } from '../../utils/productIcons';
import { deleteShoppingItem, updateShoppingItem } from '../../services/shopping';

export default function ShoppingItemModal({ item, onClose }) {
  const { t } = useT();
  const [quantity, setQuantity] = useState('');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  // Reset local form state whenever a different item is opened.
  useEffect(() => {
    setQuantity(item?.quantity || '');
    setIconPickerOpen(false);
  }, [item?.id]);

  if (!item) return null;

  const useLetter = item.icon === LETTER_ICON;
  const emojiIcon = useLetter ? '' : (item.icon || guessProductIcon(item.title));

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
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
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
          <h3 className="mb-3 text-sm font-semibold text-slate-900">{t('shopping.settings')}</h3>
          <button
            type="button"
            onClick={() => setIconPickerOpen((v) => !v)}
            className="flex w-full flex-col items-center gap-2 rounded-2xl bg-slate-100 py-5 text-slate-700 hover:bg-slate-200"
          >
            {useLetter ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-400 text-xl font-bold leading-none">
                {productInitial(item.title)}
              </span>
            ) : (
              <span className="text-3xl leading-none">{emojiIcon}</span>
            )}
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <ImageIcon size={16} />
              {t('shopping.changeIcon')}
            </span>
          </button>

          {iconPickerOpen && (
            <div className="mt-3 grid grid-cols-8 gap-2 rounded-2xl border border-slate-200 p-3">
              {/* First-letter option as an alternative to an emoji */}
              <button
                type="button"
                onClick={() => pickIcon(LETTER_ICON)}
                className={`flex aspect-square items-center justify-center rounded-xl hover:bg-slate-100 ${
                  useLetter ? 'bg-brand-100 ring-2 ring-brand-400' : ''
                }`}
                aria-label={t('shopping.useLetter')}
                title={t('shopping.useLetter')}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-500 text-sm font-bold leading-none">
                  {productInitial(item.title)}
                </span>
              </button>
              {PRODUCT_ICONS.map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  type="button"
                  onClick={() => pickIcon(emoji)}
                  className={`flex aspect-square items-center justify-center rounded-xl text-xl hover:bg-slate-100 ${
                    emojiIcon === emoji ? 'bg-brand-100 ring-2 ring-brand-400' : ''
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
