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
  const isTasksRoute  = location.pathname.startsWith('/tasks');
  const isHealthRoute = location.pathname.startsWith('/health');

  const [adding, setAdding] = useState(false);
  const [createDefaultDate, setCreateDefaultDate] = useState(null);

  // VaccinationPage registers its own FAB handler here so the shared + button
  // opens the add-vaccination modal instead of the event modal on /health.
  const [healthFabCallback, setHealthFabCallback] = useState(null);

  async function handleCreateEvent(values) {
    await createEvent({ familyId: userDoc.familyId, userId: user.uid, ...values });
    setAdding(false);
  }

  async function handleCreateTask(values) {
    await createTask({ familyId: userDoc.familyId, userId: user.uid, ...values });
    setAdding(false);
  }

  function handleFab() {
    if (isHealthRoute && healthFabCallback) {
      healthFabCallback();
    } else {
      setAdding(true);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Outlet context={{ setCreateDefaultDate, setHealthFabCallback }} />
      <BottomNav onAdd={handleFab} />
      {isTasksRoute ? (
        <TaskFormModal
          open={adding}
          onClose={() => setAdding(false)}
          onSubmit={handleCreateTask}
        />
      ) : !isHealthRoute ? (
        <EventFormModal
          open={adding}
          onClose={() => setAdding(false)}
          onSubmit={handleCreateEvent}
          initialDate={createDefaultDate}
        />
      ) : null}
    </div>
  );
}
