import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import EventFormModal from '../calendar/EventFormModal';
import TaskFormModal from '../tasks/TaskFormModal';
import useAuth from '../../hooks/useAuth';
import { createEvent } from '../../services/events';
import { createTask } from '../../services/tasks';

export default function AppShell() {
  const { user, userDoc } = useAuth();
  const location = useLocation();
  const isTasksRoute = location.pathname.startsWith('/tasks');

  const [adding, setAdding] = useState(false);
  // Pages can publish a preferred default date for the FAB (e.g. the calendar
  // page pushes its selected day here so "+" prefills to the right day).
  const [createDefaultDate, setCreateDefaultDate] = useState(null);

  async function handleCreateEvent(values) {
    await createEvent({
      familyId: userDoc.familyId,
      userId: user.uid,
      ...values,
    });
    setAdding(false);
  }

  async function handleCreateTask(values) {
    await createTask({
      familyId: userDoc.familyId,
      userId: user.uid,
      ...values,
    });
    setAdding(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Outlet context={{ setCreateDefaultDate }} />
      <BottomNav onAdd={() => setAdding(true)} />
      {isTasksRoute ? (
        <TaskFormModal
          open={adding}
          onClose={() => setAdding(false)}
          onSubmit={handleCreateTask}
        />
      ) : (
        <EventFormModal
          open={adding}
          onClose={() => setAdding(false)}
          onSubmit={handleCreateEvent}
          initialDate={createDefaultDate}
        />
      )}
    </div>
  );
}
