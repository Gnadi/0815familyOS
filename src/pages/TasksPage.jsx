import { useRef, useState } from 'react';
import TopBar from '../components/layout/TopBar';
import Spinner from '../components/common/Spinner';
import EfficiencyScoreCard from '../components/tasks/EfficiencyScoreCard';
import ColumnSection from '../components/tasks/ColumnSection';
import CapacityHeatmap from '../components/tasks/CapacityHeatmap';
import ProTipBanner from '../components/tasks/ProTipBanner';
import TaskFormModal from '../components/tasks/TaskFormModal';
import useAuth from '../hooks/useAuth';
import useTasks from '../hooks/useTasks';
import useFamilyMembers from '../hooks/useFamilyMembers';
import { updateTask, deleteTask } from '../services/tasks';

export default function TasksPage() {
  const { userDoc } = useAuth();
  const { tasks, loading } = useTasks(userDoc?.familyId);
  const members = useFamilyMembers();
  const [editingTask, setEditingTask] = useState(null);
  const backlogRef = useRef(null);

  async function handleEditSubmit(values) {
    if (!editingTask) return;
    await updateTask(editingTask.id, values);
    setEditingTask(null);
  }

  async function handleEditDelete() {
    if (!editingTask) return;
    await deleteTask(editingTask.id);
    setEditingTask(null);
  }

  function scrollToBacklog() {
    backlogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <TopBar title="Task Board" />
      <main className="mx-auto max-w-md px-4 py-5">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-slate-900">Weekly Household Logistics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Strategic oversight for the family ecosystem.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-5">
            <EfficiencyScoreCard tasks={tasks} members={members} />

            <ColumnSection
              status="backlog"
              tasks={tasks}
              members={members}
              onTaskClick={setEditingTask}
              sectionRef={backlogRef}
            />
            <ColumnSection
              status="inProgress"
              tasks={tasks}
              members={members}
              onTaskClick={setEditingTask}
            />
            <ColumnSection
              status="completed"
              tasks={tasks}
              members={members}
              onTaskClick={setEditingTask}
            />

            <CapacityHeatmap tasks={tasks} />
            <ProTipBanner tasks={tasks} onRebalance={scrollToBacklog} />
          </div>
        )}
      </main>

      <TaskFormModal
        open={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        onSubmit={handleEditSubmit}
        onDelete={handleEditDelete}
        initial={editingTask}
      />
    </>
  );
}
