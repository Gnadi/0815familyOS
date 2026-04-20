import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import EventFormModal from '../calendar/EventFormModal';
import useAuth from '../../hooks/useAuth';
import { createEvent } from '../../services/events';

export default function AppShell() {
  const { user, userDoc } = useAuth();
  const [adding, setAdding] = useState(false);

  async function handleCreate(values) {
    await createEvent({
      familyId: userDoc.familyId,
      userId: user.uid,
      ...values,
    });
    setAdding(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Outlet />
      <BottomNav onAdd={() => setAdding(true)} />
      <EventFormModal
        open={adding}
        onClose={() => setAdding(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
