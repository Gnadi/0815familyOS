import { useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Search, X } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const backlogRef = useRef(null);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => {
      const haystack = [t.title, t.description, t.category, t.priority]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [tasks, searchQuery]);

  // Require a small movement before starting a drag so a tap still opens the
  // edit modal. Touch gets a short press-and-hold activation so scrolling the
  // page doesn't accidentally pick up a card.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const activeTask = activeTaskId ? filteredTasks.find((t) => t.id === activeTaskId) : null;

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
    const draggedTask = tasks.find((t) => t.id === active.id);
    try {
      await updateTaskStatus(active.id, nextStatus, previousStatus, draggedTask);
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
          <h1 className="text-2xl font-bold text-slate-900">Weekly Household Logistics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Strategic oversight for the family ecosystem.
          </p>
        </div>

        <div className="relative mb-4">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
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
                tasks={filteredTasks}
                members={members}
                onTaskClick={setEditingTask}
                sectionRef={backlogRef}
              />
              <ColumnSection
                status="planned"
                tasks={filteredTasks}
                members={members}
                onTaskClick={setEditingTask}
              />
              <ColumnSection
                status="inProgress"
                tasks={filteredTasks}
                members={members}
                onTaskClick={setEditingTask}
              />
              <ColumnSection
                status="completed"
                tasks={filteredTasks}
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
