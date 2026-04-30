import { Syringe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import useVaccinations from '../../hooks/useVaccinations';

export default function HealthAlerts() {
  const { userDoc, family } = useAuth();
  const { vaccinations } = useVaccinations(userDoc?.familyId);
  const navigate = useNavigate();

  const now = new Date();
  const dueThisMonth = vaccinations
    .filter(
      (v) =>
        v.status !== 'done' &&
        v.date &&
        v.date.getMonth() === now.getMonth() &&
        v.date.getFullYear() === now.getFullYear(),
    )
    .sort((a, b) => a.date - b.date);

  if (dueThisMonth.length === 0) return null;

  const first = dueThisMonth[0];
  const kid = (family?.kids || []).find((k) => k.id === first.kidId);
  const description =
    dueThisMonth.length === 1
      ? `${kid?.name ?? 'A child'} is due for ${first.name} this month.`
      : `${dueThisMonth.length} vaccinations are due this month.`;

  return (
    <section>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Health Alerts</h2>
      <div className="mt-3 rounded-2xl bg-red-50/60 p-5 dark:bg-red-950/40">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500">
            <Syringe size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Upcoming Vaccination</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/health')}
          className="mt-4 w-full rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:bg-slate-800 dark:hover:bg-red-950/40"
        >
          Show Details
        </button>
      </div>
    </section>
  );
}
