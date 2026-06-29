import TopBar from '../components/layout/TopBar';
import DailyPreview from '../components/dashboard/DailyPreview';
import WeeklyPreview from '../components/dashboard/WeeklyPreview';
import WorkloadBalance from '../components/dashboard/WorkloadBalance';
import HealthAlerts from '../components/dashboard/HealthAlerts';
import QuickAccess from '../components/dashboard/QuickAccess';
import UpcomingBirthdays from '../components/dashboard/UpcomingBirthdays';
import useAuth from '../hooks/useAuth';
import useUIPreferences from '../hooks/useUIPreferences';
import useT from '../hooks/useT';

export default function DashboardPage() {
  const { userDoc } = useAuth();
  const { skin } = useUIPreferences();
  const { t } = useT();
  const name = userDoc?.displayName?.split(' ')[0] || t('dashboard.greetingFallback');
  const ios = skin === 'ios';

  return (
    <>
      {/* iOS folds the greeting into the large navigation title; Material keeps
          the in-body heading under the generic app bar. */}
      <TopBar title={ios ? t('dashboard.greeting', { name }) : t('common.appName')} />
      <main className="mx-auto max-w-md space-y-7 px-5 py-6">
        {!ios && (
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.greeting', { name })}</h1>
            <p className="mt-1 text-sm text-slate-500">{t('dashboard.subtitle')}</p>
          </div>
        )}
        <DailyPreview />
        <WeeklyPreview />
        <UpcomingBirthdays />
        <WorkloadBalance />
        <HealthAlerts />
        <QuickAccess />
      </main>
    </>
  );
}
