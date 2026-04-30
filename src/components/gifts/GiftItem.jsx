const STATUS_STYLES = {
  idea:   { label: 'IDEA',   className: 'text-slate-400 text-xs font-medium' },
  bought: { label: 'BOUGHT', className: 'rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700' },
  gifted: { label: 'GIFTED', className: 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700' },
};

export default function GiftItem({ gift, onEdit }) {
  const s = STATUS_STYLES[gift.status] ?? STATUS_STYLES.idea;

  return (
    <button
      onClick={() => onEdit(gift)}
      className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-card hover:bg-slate-50 transition dark:bg-slate-800 dark:hover:bg-slate-700"
    >
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{gift.title}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {gift.price > 0
            ? `$${gift.price.toFixed(2)}`
            : 'Est. price TBD'}
        </p>
      </div>
      <span className={s.className}>{s.label}</span>
    </button>
  );
}
