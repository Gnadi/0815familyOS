import TopBar from '../components/layout/TopBar';
import DailyPreview from '../components/dashboard/DailyPreview';
import WeeklyPreview from '../components/dashboard/WeeklyPreview';
import WorkloadBalance from '../components/dashboard/WorkloadBalance';
import HealthAlerts from '../components/dashboard/HealthAlerts';
import QuickAccess from '../components/dashboard/QuickAccess';
import useAuth from '../hooks/useAuth';

export default function DashboardPage() {
  const { userDoc } = useAuth();
  const name = userDoc?.displayName?.split(' ')[0] || 'there';

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-md space-y-7 px-5 py-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Hello, {name}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Here's what's happening today.</p>
        </div>
        <DailyPreview />
        <WeeklyPreview />
        <WorkloadBalance />
        <HealthAlerts />
        <QuickAccess />
      </main>
    </>
  );
}
