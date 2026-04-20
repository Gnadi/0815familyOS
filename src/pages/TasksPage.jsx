import { ListChecks } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import EmptyState from '../components/common/EmptyState';

export default function TasksPage() {
  return (
    <>
      <TopBar title="Tasks" />
      <main className="mx-auto max-w-md px-5 py-8">
        <EmptyState
          icon={ListChecks}
          title="Tasks coming soon"
          description="Chore lists, homework tracking, and family to-dos are on the roadmap."
        />
      </main>
    </>
  );
}
