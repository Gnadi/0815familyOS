import { format } from 'date-fns';
import { Sparkles } from 'lucide-react';
import { computeCapacityLoad, currentSprintMonday } from '../../utils/tasks';

function pickTip(tasks) {
  const capacity = computeCapacityLoad(tasks, currentSprintMonday());
  const heaviest = [...capacity]
    .filter((d) => d.level === 'high')
    .sort((a, b) => b.points - a.points)[0];

  if (heaviest && heaviest.tasks.length > 0) {
    const suggestion = heaviest.tasks.reduce(
      (top, t) => ((t.points || 0) > (top?.points || 0) ? t : top),
      null
    );
    return {
      text: `${format(heaviest.date, 'EEEE')} is looking heavy. Consider rebalancing "${
        suggestion?.title || 'a task'
      }" to a lighter day.`,
      action: 'Rebalance Board',
    };
  }

  const midDays = capacity.filter((d) => d.level === 'mid');
  if (midDays.length >= 3) {
    return {
      text: 'Load is trending steady this week. Good time to tackle a backlog item.',
      action: 'Open Backlog',
    };
  }

  return {
    text: 'Balanced load across the week. Keep shipping and close out the sprint.',
    action: 'Open Backlog',
  };
}

export default function ProTipBanner({ tasks, onRebalance }) {
  const tip = pickTip(tasks);

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Sparkles size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-slate-700">
            <span className="font-semibold text-slate-900">Pro-tip:</span> {tip.text}
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
