import { Repeat } from 'lucide-react';
import { FREQS } from '../../utils/recurrence';

const FREQ_LABEL = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

export default function RecurrenceField({ value, onChange }) {
  const enabled = Boolean(value && value.freq);
  const freq = value?.freq || 'weekly';
  const interval = value?.interval || 1;
  const until = value?.until || '';

  function toggle(next) {
    if (next) onChange({ freq, interval, until: until || null });
    else onChange(null);
  }

  function patch(fields) {
    onChange({ freq, interval, until: until || null, ...fields });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <label className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Repeat size={14} /> Repeat
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggle(e.target.checked)}
          className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
      </label>

      {enabled && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">Every</span>
            <input
              type="number"
              min={1}
              max={99}
              value={interval}
              onChange={(e) => patch({ interval: Math.max(1, Number(e.target.value) || 1) })}
              className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
            />
            <select
              value={freq}
              onChange={(e) => patch({ freq: e.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
            >
              {FREQS.map((f) => (
                <option key={f} value={f}>
                  {FREQ_LABEL[f]}{interval > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <span>Until</span>
            <input
              type="date"
              value={until}
              onChange={(e) => patch({ until: e.target.value || null })}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
            />
            {until && (
              <button
                type="button"
                onClick={() => patch({ until: null })}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                clear
              </button>
            )}
          </label>
        </div>
      )}
    </div>
  );
}
