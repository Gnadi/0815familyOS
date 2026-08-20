import { Check, Plus, Timer } from 'lucide-react';
import { format } from 'date-fns';
import { trackerColor } from '../../constants/trackerPresets';
import useT from '../../hooks/useT';

const SINCE_KEY = {
  now: 'tracker.justNow',
  minute: 'tracker.agoMinutes',
  hour: 'tracker.agoHours',
  day: 'tracker.agoDays',
  soon: 'tracker.justNow',
};

function agoLabel(since, { t, tn }) {
  const { unit, count } = since;
  return unit === 'now' || unit === 'soon' ? t(SINCE_KEY.now) : tn(SINCE_KEY[unit], count);
}

// The one-line answer to "when was this last?" / "did this happen today?".
function statusLine(status, { t, tn }) {
  if (status.hasGoal) {
    const progress = t('tracker.todayProgress', { count: status.todayCount, goal: status.goal });
    if (!status.lastAt) return progress;
    // A bare clock time would read as "this morning" for an entry that is
    // actually days old, so only today's entries get one.
    const suffix = status.lastWasToday
      ? t('tracker.lastAt', { time: format(status.lastAt, 'HH:mm') })
      : t('tracker.lastAgo', { ago: agoLabel(status.since, { t, tn }) });
    return `${progress} · ${suffix}`;
  }
  if (!status.lastAt) return t('tracker.neverLogged');
  return `${t('tracker.lastLabel')} ${agoLabel(status.since, { t, tn })} · ${format(status.lastAt, 'EEE HH:mm')}`;
}

export default function TrackerCard({ tracker, status, onLog, onOpen }) {
  const { t, tn } = useT();
  const color = trackerColor(tracker.color);
  const done = status.goalMet;

  const valueLine =
    status.todaySum != null
      ? t('tracker.todayTotal', {
          value: status.todaySum,
          unit: tracker.unit || '',
        }).trim()
      : null;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card">
      <button
        type="button"
        onClick={() => onOpen(tracker)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className={`relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-xl ${color.bubble}`}
        >
          {tracker.emoji}
          {done && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
              <Check size={10} strokeWidth={3} />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">{tracker.name}</span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {statusLine(status, { t, tn })}
          </span>
          {valueLine && (
            <span className="mt-0.5 block truncate text-xs text-slate-400">{valueLine}</span>
          )}
          {status.cooldownActive && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              <Timer size={11} />
              {t('tracker.nextAt', { time: format(status.cooldownUntil, 'HH:mm') })}
            </span>
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onLog(tracker)}
        aria-label={t('tracker.logNow', { name: tracker.name })}
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white shadow-sm transition active:scale-95 ${color.button}`}
      >
        <Plus size={22} />
      </button>
    </div>
  );
}
