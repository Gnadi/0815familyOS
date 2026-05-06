import { format } from 'date-fns';
import { ExternalLink, User } from 'lucide-react';
import useCategories from '../../hooks/useCategories';
import useAuth from '../../hooks/useAuth';

const EFFORT = {
  low:    { bar: 'bg-green-400',  badge: 'text-green-700 bg-green-100',   label: 'Low Effort' },
  medium: { bar: 'bg-amber-400',  badge: 'text-amber-700 bg-amber-100',   label: 'Med Effort' },
  high:   { bar: 'bg-rose-400',   badge: 'text-rose-700 bg-rose-100',     label: 'High Effort' },
};

const KID_CHIP = {
  violet: 'bg-violet-100 text-violet-700',
  sky:    'bg-sky-100 text-sky-700',
  pink:   'bg-pink-100 text-pink-700',
  teal:   'bg-teal-100 text-teal-700',
  orange: 'bg-orange-100 text-orange-700',
  indigo: 'bg-indigo-100 text-indigo-700',
};

export default function EventCard({ event, onClick }) {
  const { get } = useCategories();
  const { family } = useAuth();
  const cat = get(event.category);

  const effort = event.effortLevel ? EFFORT[event.effortLevel] : null;
  const barClass = effort ? effort.bar : cat.bar;

  const familyKids = family?.kids || [];
  const eventKids = (event.kids || [])
    .map((id) => familyKids.find((k) => k.id === id))
    .filter(Boolean);

  return (
    <button
      onClick={onClick}
      className="flex w-full items-stretch gap-3 rounded-2xl bg-white p-4 text-left shadow-card hover:bg-slate-50"
    >
      <div className="w-16 flex-shrink-0 text-right">
        <p className="text-sm font-semibold text-slate-900">
          {format(event.date, 'HH:mm')}
        </p>
        <p className="text-xs text-slate-400">{format(event.date, 'a')}</p>
      </div>
      <div className={`w-1 flex-shrink-0 rounded-full ${barClass}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-1.5 truncate text-base font-semibold text-slate-900">
            {event.source === 'subscription' && (
              <ExternalLink
                size={12}
                className="flex-shrink-0 text-slate-400"
                aria-label="Synced from external calendar"
              />
            )}
            <span className="truncate">{event.title}</span>
          </h3>
          {effort ? (
            <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${effort.badge}`}>
              {effort.label}
            </span>
          ) : (
            <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cat.chipBg} ${cat.chipText}`}>
              {cat.label}
            </span>
          )}
        </div>
        {eventKids.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {eventKids.map((kid) => (
              <span
                key={kid.id}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${KID_CHIP[kid.color] || 'bg-slate-100 text-slate-700'}`}
              >
                <span>🙂</span>
                {kid.name}
              </span>
            ))}
          </div>
        )}
        {event.responsibleParent && (
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <User size={12} className="flex-shrink-0" />
            {event.responsibleParent}
          </div>
        )}
        {event.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{event.description}</p>
        )}
      </div>
    </button>
  );
}
