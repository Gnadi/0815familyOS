import GiftItem from './GiftItem';

const COLOR_DOT = {
  violet: 'bg-violet-500',
  sky:    'bg-sky-500',
  pink:   'bg-pink-500',
  teal:   'bg-teal-500',
  orange: 'bg-orange-500',
  indigo: 'bg-indigo-500',
};

export default function GiftRecipientSection({ kid, gifts, onEdit }) {
  const spent = gifts
    .filter((g) => g.status === 'bought' || g.status === 'gifted')
    .reduce((sum, g) => sum + g.price, 0);

  const dotColor = COLOR_DOT[kid.color] ?? 'bg-slate-400';

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${dotColor}`} />
          <h3 className="text-base font-bold text-slate-900">{kid.name}</h3>
        </div>
        <span className="text-sm text-slate-500">${spent.toFixed(2)} Spent</span>
      </div>
      {gifts.length === 0 ? (
        <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-400 shadow-card">
          No gifts added yet — tap + to add one.
        </p>
      ) : (
        <div className="space-y-2">
          {gifts.map((gift) => (
            <GiftItem key={gift.id} gift={gift} onEdit={onEdit} />
          ))}
        </div>
      )}
    </section>
  );
}
