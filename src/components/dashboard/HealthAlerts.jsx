import { Syringe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import useVaccinations from '../../hooks/useVaccinations';
import useT from '../../hooks/useT';

const HORIZON_DAYS = 30;

export default function HealthAlerts() {
  const { userDoc, family } = useAuth();
  const { vaccinations } = useVaccinations(userDoc?.familyId);
  const { t } = useT();
  const navigate = useNavigate();

  // A rolling window, not the calendar month: a shot due in three days must
  // still raise an alert when those three days happen to cross into the next
  // month, and one that came due weeks ago is exactly what needs chasing.
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + HORIZON_DAYS);
  horizon.setHours(23, 59, 59, 999);

  const dueSoon = vaccinations
    .filter((v) => v.status !== 'done' && v.date && v.date <= horizon)
    .sort((a, b) => a.date - b.date);

  if (dueSoon.length === 0) return null;

  const first = dueSoon[0];
  const kid = (family?.kids || []).find((k) => k.id === first.kidId);
  const description =
    dueSoon.length === 1
      ? t('dashboard.vaccDueOne', { name: kid?.name ?? t('dashboard.childFallback'), vaccine: first.name })
      : t('dashboard.vaccDueMany', { count: dueSoon.length });

  return (
    <section>
      <h2 className="text-lg font-bold text-slate-900">{t('dashboard.healthAlerts')}</h2>
      <div className="mt-3 rounded-2xl bg-red-50/60 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500">
            <Syringe size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{t('dashboard.upcomingVaccination')}</h3>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/health')}
          className="mt-4 w-full rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
        >
          {t('dashboard.showDetails')}
        </button>
      </div>
    </section>
  );
}
