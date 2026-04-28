import { useState } from 'react';
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
  const isTasksRoute = location.pathname.startsWith('/tasks');
  const isGiftsRoute = location.pathname.startsWith('/gifts');
  const isVaultRoute = location.pathname.startsWith('/vault');

  const [adding, setAdding] = useState(false);
  const [createDefaultDate, setCreateDefaultDate] = useState(null);
  const [vaultAdd, setVaultAdd] = useState(null);

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

  async function handleCreateGift(values) {
    await createGift({
      familyId: userDoc.familyId,
      ...values,
    });
    setAdding(false);
  }

  function handleAdd() {
    if (isVaultRoute) {
      vaultAdd?.();
    } else {
      setAdding(true);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Outlet context={{ setCreateDefaultDate, setVaultAdd }} />
      <BottomNav onAdd={handleAdd} />
      {!isVaultRoute && (
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
