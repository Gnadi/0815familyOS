import useT from '../../hooks/useT';

const STATUS_STYLES = {
  idea:   { labelKey: 'gifts.badgeIdea',   className: 'text-slate-400 text-xs font-medium' },
  bought: { labelKey: 'gifts.badgeBought', className: 'rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700' },
  gifted: { labelKey: 'gifts.badgeGifted', className: 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700' },
};

export default function GiftItem({ gift, onEdit }) {
  const { t } = useT();
  const s = STATUS_STYLES[gift.status] ?? STATUS_STYLES.idea;

  return (
    <button
      onClick={() => onEdit(gift)}
      className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-card hover:bg-slate-50 transition"
    >
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{gift.title}</p>
        <p className="text-xs text-slate-400">
          {gift.price > 0
            ? `$${gift.price.toFixed(2)}`
            : t('gifts.estPriceTBD')}
        </p>
      </div>
      <span className={s.className}>{t(s.labelKey)}</span>
    </button>
  );
}
