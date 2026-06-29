import AvatarStack from '../common/AvatarStack';
import { computeEfficiencyScore } from '../../utils/tasks';
import useT from '../../hooks/useT';

export default function EfficiencyScoreCard({ tasks, members }) {
  const { t } = useT();
  const { score, completedPoints, totalPoints } = computeEfficiencyScore(tasks);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
            {t('tasks.efficiencyScore')}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${Math.min(100, score)}%` }}
              />
            </div>
            <span className="text-lg font-bold text-slate-900 tabular-nums">
              {score}%
            </span>
          </div>
          <p className="mt-1.5 text-[11px] font-medium text-slate-500 tabular-nums">
            {t('tasks.ptsCompletedSprint', { completed: completedPoints, total: totalPoints })}
          </p>
        </div>
        <AvatarStack members={members} max={3} size="md" />
      </div>
    </div>
  );
}
