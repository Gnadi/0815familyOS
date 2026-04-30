import { useMemo } from 'react';
import { Scale } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import useEvents from '../../hooks/useEvents';
import useFamilyMembers from '../../hooks/useFamilyMembers';
import { getWeekDays } from '../../utils/date';

const EFFORT_SCORE = { low: 1, medium: 2, high: 3 };

function getSummary(rows, spread) {
  if (rows.length <= 1) return 'All events assigned to one person this week.';
  if (spread <= 10) return 'Looking balanced this week!';
  if (spread <= 25) return 'Slightly uneven — check in with each other.';
  return 'Workload looks uneven this week.';
}

export default function WorkloadBalance() {
  const { userDoc } = useAuth();
  const { events, loading } = useEvents(userDoc?.familyId);
  const members = useFamilyMembers();

  const { rows, totalScore, spread } = useMemo(() => {
    const weekDays = getWeekDays(new Date());
    const weekStart = weekDays[0];
    const weekEnd = new Date(weekDays[6]);
    weekEnd.setHours(23, 59, 59, 999);

    const weekEvents = events.filter(
      (e) => e.date >= weekStart && e.date <= weekEnd && e.responsibleParent
    );

    const accumulator = {};
    for (const e of weekEvents) {
      const score = EFFORT_SCORE[e.effortLevel] ?? 1;
      accumulator[e.responsibleParent] = (accumulator[e.responsibleParent] ?? 0) + score;
    }

    const totalScore = Object.values(accumulator).reduce((sum, s) => sum + s, 0);

    const nameList =
      members.length > 0
        ? members.map((m) => m.displayName)
        : Object.keys(accumulator);

    const rows = nameList
      .map((name) => ({
        name,
        score: accumulator[name] ?? 0,
        pct: totalScore > 0 ? Math.round(((accumulator[name] ?? 0) / totalScore) * 100) : 0,
      }))
      .sort((a, b) => b.score - a.score);

    const spread = rows.length >= 2 ? rows[0].pct - rows[rows.length - 1].pct : 0;

    return { rows, totalScore, spread };
  }, [events, members]);

  return (
    <section>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Workload Balance</h2>
      <div className="mt-3 rounded-2xl bg-white p-5 shadow-card dark:bg-slate-800">
        {loading ? (
          <div className="py-4 text-center text-sm text-slate-400 dark:text-slate-500">Loading…</div>
        ) : totalScore === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <Scale size={18} />
            </div>
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">No workload data yet</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Assign events to family members this week to see the balance.
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-4">
              {rows.map((row, i) => (
                <li key={row.name}>
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{row.name}</p>
                    <p className={`text-sm font-bold ${i === 0 ? 'text-brand-500' : 'text-slate-400 dark:text-slate-500'}`}>
                      {row.pct}%
                    </p>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className={`h-full rounded-full transition-all ${i === 0 ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">{getSummary(rows, spread)}</p>
          </>
        )}
      </div>
    </section>
  );
}
