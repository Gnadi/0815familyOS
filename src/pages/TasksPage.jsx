import { useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import TopBar from '../components/layout/TopBar';
import Spinner from '../components/common/Spinner';
import EfficiencyScoreCard from '../components/tasks/EfficiencyScoreCard';
import ColumnSection from '../components/tasks/ColumnSection';
import CapacityHeatmap from '../components/tasks/CapacityHeatmap';
import ProTipBanner from '../components/tasks/ProTipBanner';
import TaskFormModal from '../components/tasks/TaskFormModal';
import { TaskCardPreview } from '../components/tasks/TaskCard';
import useAuth from '../hooks/useAuth';
import useTasks from '../hooks/useTasks';
import useFamilyMembers from '../hooks/useFamilyMembers';
import { updateTask, updateTaskStatus, deleteTask } from '../services/tasks';

export default function TasksPage() {
  const { userDoc } = useAuth();
  const { tasks, loading } = useTasks(userDoc?.familyId);
  const members = useFamilyMembers();
  const [editingTask, setEditingTask] = useState(null);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const backlogRef = useRef(null);

  // Require a small movement before starting a drag so a tap still opens the
  // edit modal. Touch gets a short press-and-hold activation so scrolling the
  // page doesn't accidentally pick up a card.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) : null;

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

  function handleDragStart(event) {
    setActiveTaskId(event.active.id);
  }

  function handleDragCancel() {
    setActiveTaskId(null);
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    setActiveTaskId(null);
    if (!over) return;
    const nextStatus = over.data.current?.status;
    const previousStatus = active.data.current?.status;
    if (!nextStatus || nextStatus === previousStatus) return;
    try {
      await updateTaskStatus(active.id, nextStatus, previousStatus);
    } catch (err) {
      console.error('Failed to move task', err);
    }
  }

  function scrollToBacklog() {
    backlogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <TopBar title="Task Board" />
      <main className="mx-auto max-w-md px-4 py-5">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Weekly Household Logistics</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Strategic oversight for the family ecosystem.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
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
                status="planned"
                tasks={tasks}
                members={members}
                onTaskClick={setEditingTask}
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

            <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
              {activeTask ? (
                <TaskCardPreview task={activeTask} members={members} />
              ) : null}
            </DragOverlay>
          </DndContext>
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
