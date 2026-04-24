import AvatarStack from '../common/AvatarStack';
import { computeEfficiencyScore, currentSprintMonday, tasksForSprint } from '../../utils/tasks';

export default function EfficiencyScoreCard({ tasks, members }) {
  const monday = currentSprintMonday();
  const { score } = computeEfficiencyScore(tasks, monday);

  // Only show members who actually have a task in this sprint.
  const sprintTasks = tasksForSprint(tasks, monday);
  const activeIds = new Set();
  sprintTasks.forEach((t) => (t.assigneeIds || []).forEach((id) => activeIds.add(id)));
  const activeMembers = members.filter((m) => activeIds.has(m.uid));
  const displayMembers = activeMembers.length ? activeMembers : members;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
            Efficiency Score
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
        </div>
        <AvatarStack members={displayMembers} max={3} size="md" />
      </div>
    </div>
  );
}
