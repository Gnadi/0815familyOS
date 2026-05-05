import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import EventFormModal from '../calendar/EventFormModal';
import TaskFormModal from '../tasks/TaskFormModal';
import GiftFormModal from '../gifts/GiftFormModal';
import useAuth from '../../hooks/useAuth';
import { createEvent } from '../../services/events';
import { createTask } from '../../services/tasks';
import { createGift } from '../../services/gifts';
import { syncSubscription, updateSubscriptionMeta } from '../../services/calendarSubscriptions';

const SYNC_STALE_MS = 60 * 60 * 1000; // re-sync subscriptions older than 1 hour

export default function AppShell() {
  const { user, userDoc, family } = useAuth();
  const location = useLocation();
  const isTasksRoute  = location.pathname.startsWith('/tasks');
  const isGiftsRoute  = location.pathname.startsWith('/gifts');
  const isVaultRoute  = location.pathname.startsWith('/vault');
  const isHealthRoute = location.pathname.startsWith('/health');

  const [adding, setAdding] = useState(false);
  const [createDefaultDate, setCreateDefaultDate] = useState(null);

  // DocumentVaultPage registers a callback to open its own upload modal
  const [vaultAdd, setVaultAdd] = useState(null);

  // VaccinationPage registers a callback to open its own add-vaccination modal
  const [healthFabCallback, setHealthFabCallback] = useState(null);

  // Re-sync any stale calendar subscriptions in the background once per
  // session. Intentionally fire-and-forget; errors land in the subscription's
  // lastError field and surface in Settings.
  const syncedThisSession = useRef(new Set());
  useEffect(() => {
    if (!family?.id || !user?.uid) return;
    const subs = family.calendarSubscriptions || [];
    const now = Date.now();
    for (const sub of subs) {
      if (!sub?.id || syncedThisSession.current.has(sub.id)) continue;
      const last = sub.lastSyncAt ? new Date(sub.lastSyncAt).getTime() : 0;
      if (now - last < SYNC_STALE_MS) continue;
      syncedThisSession.current.add(sub.id);
      syncSubscription({ familyId: family.id, userId: user.uid, subscription: sub }).catch(
        (err) => {
          updateSubscriptionMeta(family.id, sub.id, {
            lastError: err.message || 'Background sync failed.',
          }).catch(() => {});
        },
      );
    }
  }, [family?.id, user?.uid, family?.calendarSubscriptions]);

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
    <div className="min-h-screen bg-slate-50 pb-24">
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
