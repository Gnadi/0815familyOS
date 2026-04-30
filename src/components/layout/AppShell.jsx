import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import EventFormModal from '../calendar/EventFormModal';
import TaskFormModal from '../tasks/TaskFormModal';
import GiftFormModal from '../gifts/GiftFormModal';
import useAuth from '../../hooks/useAuth';
import { createEvent } from '../../services/events';
import { createTask } from '../../services/tasks';
import { createGift } from '../../services/gifts';

export default function AppShell() {
  const { user, userDoc, family } = useAuth();
  const location = useLocation();
  const isTasksRoute  = location.pathname.startsWith('/tasks');
  const isGiftsRoute  = location.pathname.startsWith('/gifts');
  const isVaultRoute  = location.pathname.startsWith('/vault');
  const isHealthRoute = location.pathname.startsWith('/health');

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('dark', !!userDoc?.darkTheme);

    html.classList.remove('text-sm-scale', 'text-lg-scale');
    if (userDoc?.fontSize === 'sm') html.classList.add('text-sm-scale');
    if (userDoc?.fontSize === 'lg') html.classList.add('text-lg-scale');

    html.classList.remove('accent-purple', 'accent-green', 'accent-rose', 'accent-amber');
    if (userDoc?.accentColor && userDoc.accentColor !== 'blue') {
      html.classList.add(`accent-${userDoc.accentColor}`);
    }
  }, [userDoc?.darkTheme, userDoc?.fontSize, userDoc?.accentColor]);

  const [adding, setAdding] = useState(false);
  const [createDefaultDate, setCreateDefaultDate] = useState(null);

  // DocumentVaultPage registers a callback to open its own upload modal
  const [vaultAdd, setVaultAdd] = useState(null);

  // VaccinationPage registers a callback to open its own add-vaccination modal
  const [healthFabCallback, setHealthFabCallback] = useState(null);

  async function handleCreateEvent(values) {
    await createEvent({ familyId: userDoc.familyId, userId: user.uid, ...values });
    setAdding(false);
  }

  async function handleCreateTask(values) {
    await createTask({ familyId: userDoc.familyId, userId: user.uid, ...values });
    setAdding(false);
  }

  async function handleCreateGift(values) {
    await createGift({ familyId: userDoc.familyId, ...values });
    setAdding(false);
  }

  function handleFab() {
    if (isVaultRoute)  { vaultAdd?.(); return; }
    if (isHealthRoute) { healthFabCallback?.(); return; }
    setAdding(true);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24">
      <Outlet context={{ setCreateDefaultDate, setVaultAdd, setHealthFabCallback }} />
      <BottomNav onAdd={handleFab} />
      {!isVaultRoute && !isHealthRoute && (
        isGiftsRoute ? (
          <GiftFormModal
            open={adding}
            onClose={() => setAdding(false)}
            onSubmit={handleCreateGift}
            kids={family?.kids ?? []}
          />
        ) : isTasksRoute ? (
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
        )
      )}
    </div>
  );
}
