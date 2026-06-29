import { format } from 'date-fns';
import { Sparkles } from 'lucide-react';
import { computeCapacityLoad, currentSprintMonday } from '../../utils/tasks';
import useT from '../../hooks/useT';

// Picks a tip and returns i18n keys/params so the banner renders it in the
// active language.
function pickTip(tasks, t) {
  const capacity = computeCapacityLoad(tasks, currentSprintMonday());
  const heaviest = [...capacity]
    .filter((d) => d.level === 'high')
    .sort((a, b) => b.points - a.points)[0];

  if (heaviest && heaviest.tasks.length > 0) {
    const suggestion = heaviest.tasks.reduce(
      (top, task) => ((task.points || 0) > (top?.points || 0) ? task : top),
      null
    );
    return {
      text: t('tasks.tipHeavyDay', {
        day: format(heaviest.date, 'EEEE'),
        task: suggestion?.title || t('tasks.tipTaskFallback'),
      }),
      action: t('tasks.actionRebalance'),
    };
  }

  const midDays = capacity.filter((d) => d.level === 'mid');
  if (midDays.length >= 3) {
    return { text: t('tasks.tipSteady'), action: t('tasks.actionOpenBacklog') };
  }

  return { text: t('tasks.tipBalanced'), action: t('tasks.actionOpenBacklog') };
}

export default function ProTipBanner({ tasks, onRebalance }) {
  const { t } = useT();
  const tip = pickTip(tasks, t);

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Sparkles size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-slate-700">
            <span className="font-semibold text-slate-900">{t('tasks.proTip')}</span> {tip.text}
          </p>
        </div>
        <button
          type="button"
          onClick={onRebalance}
          className="flex-shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          {tip.action}
        </button>
      </div>
    </div>
  );
}
