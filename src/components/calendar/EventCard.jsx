import { format } from 'date-fns';

export default function EventCard({ event, onClick }) {
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
      <div className="w-1 flex-shrink-0 rounded-full bg-brand-400" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold text-slate-900">{event.title}</h3>
        {event.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{event.description}</p>
        )}
      </div>
    </button>
  );
}
