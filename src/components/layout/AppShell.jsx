import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import DemoBanner from './DemoBanner';
import EventFormModal from '../calendar/EventFormModal';
import TaskFormModal from '../tasks/TaskFormModal';
import GiftFormModal from '../gifts/GiftFormModal';
import useAuth from '../../hooks/useAuth';
import { peekEvents } from '../../hooks/useEvents';
import { AddActionContext } from '../../context/AddActionContext';
import { createEvent } from '../../services/events';
import { createTask } from '../../services/tasks';
import { createGift } from '../../services/gifts';
import {
  cleanupOrphanedSubscriptionEvents,
  syncSubscription,
  updateSubscriptionMeta,
} from '../../services/calendarSubscriptions';

// A family calendar changes a few times a week. Re-checking every few hours
// is plenty, and an unchanged feed now costs nothing anyway.
const SYNC_STALE_MS = 3 * 60 * 60 * 1000;
const SYNC_START_DELAY_MS = 4000; // let the app finish loading before syncing

export default function AppShell() {
  const { user, userDoc, family } = useAuth();
  const location = useLocation();
  const isTasksRoute  = location.pathname.startsWith('/tasks');
  const isGiftsRoute  = location.pathname.startsWith('/gifts');
  const isVaultRoute  = location.pathname.startsWith('/vault');
  const isHealthRoute = location.pathname.startsWith('/health');
  const isTrackerRoute = location.pathname.startsWith('/tracker');
  const isFoodRoute   = location.pathname.startsWith('/meals');
  const isShoppingRoute = location.pathname.startsWith('/shopping');

  const [adding, setAdding] = useState(false);
  const [createDefaultDate, setCreateDefaultDate] = useState(null);

  // DocumentVaultPage registers a callback to open its own upload modal
  const [vaultAdd, setVaultAdd] = useState(null);

  // VaccinationPage registers a callback to open its own add-vaccination modal
  const [healthFabCallback, setHealthFabCallback] = useState(null);

  // TrackerPage registers a callback so the shared "+" creates a new tracker
  // instead of opening the event form.
  const [trackerFabCallback, setTrackerFabCallback] = useState(null);

  // FoodPage registers a callback whose behaviour depends on its active tab
  // (add a recipe vs. plan a meal).
  const [foodFabCallback, setFoodFabCallback] = useState(null);

  // ShoppingPage registers a callback so the shared "+" focuses its add field
  // instead of opening the event form.
  const [shoppingFabCallback, setShoppingFabCallback] = useState(null);

  // Re-sync any stale calendar subscriptions in the background once per
  // session. Intentionally fire-and-forget; errors land in the subscription's
  // lastError field and surface in Settings.
  //
  // Held back by SYNC_START_DELAY_MS so the fetch, the full-collection read and
  // the batch writes a sync performs do not compete with the first render for
  // the connection -- starting it immediately on mount is what left the
  // calendar sitting on "loading events" after a reload.
  const syncedThisSession = useRef(new Set());
  const sweptThisSession = useRef(null);
  useEffect(() => {
    if (!family?.id || !user?.uid) return undefined;
    const subs = family.calendarSubscriptions || [];
    const now = Date.now();
    const due = subs.filter((sub) => {
      if (!sub?.id || syncedThisSession.current.has(sub.id)) return false;
      const last = sub.lastSyncAt ? new Date(sub.lastSyncAt).getTime() : 0;
      return now - last >= SYNC_STALE_MS;
    });
    const familyId = family.id;
    const userId = user.uid;
    // Events stranded by a removal that failed part-way have no owner left, so
    // no sync would ever reach them -- least of all for a family that removed
    // its last subscription. Sweep once per session regardless.
    const needsSweep = sweptThisSession.current !== familyId;
    if (due.length === 0 && !needsSweep) return undefined;

    const timer = setTimeout(() => {
      // Whatever the live listener already holds. Handing it over keeps the
      // sync from re-reading the entire events collection out of Firestore.
      const existingEvents = peekEvents(familyId);
      // A sync sweeps orphans itself, so only pay for a standalone pass when
      // no sync is going to run.
      if (needsSweep) {
        sweptThisSession.current = familyId;
        if (due.length === 0) {
          cleanupOrphanedSubscriptionEvents(familyId, { existingEvents }).catch(() => {});
        }
      }
      for (const sub of due) {
        if (syncedThisSession.current.has(sub.id)) continue;
        syncedThisSession.current.add(sub.id);
        syncSubscription({ familyId, userId, subscription: sub, existingEvents }).catch((err) => {
          updateSubscriptionMeta(familyId, sub.id, {
            lastError: err.message || 'Background sync failed.',
          }).catch(() => {});
        });
      }
    }, SYNC_START_DELAY_MS);
    return () => clearTimeout(timer);
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
    if (isTrackerRoute) { trackerFabCallback?.(); return; }
    if (isFoodRoute)   { foodFabCallback?.(); return; }
    if (isShoppingRoute) { shoppingFabCallback?.(); return; }
    setAdding(true);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <DemoBanner />
      <AddActionContext.Provider value={handleFab}>
        <Outlet context={{ setCreateDefaultDate, setVaultAdd, setHealthFabCallback, setTrackerFabCallback, setFoodFabCallback, setShoppingFabCallback }} />
      </AddActionContext.Provider>
      <BottomNav onAdd={handleFab} />
      {!isVaultRoute && !isHealthRoute && !isTrackerRoute && !isFoodRoute && !isShoppingRoute && (
        isGiftsRoute ? (
          <GiftFormModal
            open={adding}
            onClose={() => setAdding(false)}
            onSubmit={handleCreateGift}
            recipients={[...(family?.kids ?? []), ...(family?.giftRecipients ?? [])]}
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
