import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import DemoBanner from './DemoBanner';
import EventFormModal from '../calendar/EventFormModal';
import TaskFormModal from '../tasks/TaskFormModal';
import GiftFormModal from '../gifts/GiftFormModal';
import useAuth from '../../hooks/useAuth';
import { AddActionContext } from '../../context/AddActionContext';
import { createEvent } from '../../services/events';
import { createTask } from '../../services/tasks';
import { createGift } from '../../services/gifts';
import {
  claimSyncLease,
  releaseSyncLease,
  syncSubscription,
} from '../../services/calendarSubscriptions';

const SYNC_STALE_MS = 60 * 60 * 1000; // re-sync subscriptions older than 1 hour

export default function AppShell() {
  const { user, userDoc, family } = useAuth();
  const location = useLocation();
  const isTasksRoute  = location.pathname.startsWith('/tasks');
  const isGiftsRoute  = location.pathname.startsWith('/gifts');
  const isVaultRoute  = location.pathname.startsWith('/vault');
  const isHealthRoute = location.pathname.startsWith('/health');
  const isFoodRoute   = location.pathname.startsWith('/meals');
  const isShoppingRoute = location.pathname.startsWith('/shopping');

  const [adding, setAdding] = useState(false);
  const [createDefaultDate, setCreateDefaultDate] = useState(null);

  // DocumentVaultPage registers a callback to open its own upload modal
  const [vaultAdd, setVaultAdd] = useState(null);

  // VaccinationPage registers a callback to open its own add-vaccination modal
  const [healthFabCallback, setHealthFabCallback] = useState(null);

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
  // `syncedThisSession` is per tab, so it only stops *this* device syncing twice.
  // Every member's browser runs this effect independently, which is what
  // claimSyncLease is for: the lease is the only thing making "once an hour"
  // true across a family rather than per device.
  const syncedThisSession = useRef(new Set());
  useEffect(() => {
    if (!family?.id || !user?.uid) return;
    const subs = family.calendarSubscriptions || [];
    const now = Date.now();
    for (const sub of subs) {
      if (!sub?.id || syncedThisSession.current.has(sub.id)) continue;
      const last = sub.lastSyncAt ? new Date(sub.lastSyncAt).getTime() : 0;
      if (now - last < SYNC_STALE_MS) continue;
      // Marked before the await so a re-render cannot queue a second attempt at
      // the same subscription while the claim is still in flight.
      syncedThisSession.current.add(sub.id);
      syncStaleSubscription(family.id, user.uid, sub);
    }
  }, [family?.id, user?.uid, family?.calendarSubscriptions]);

  /** Claim the lease, sync, then hand it back. Never throws. */
  async function syncStaleSubscription(familyId, userId, sub) {
    let held = false;
    try {
      held = await claimSyncLease(familyId, sub.id);
      // Another member's device got there first. Theirs will write lastSyncAt,
      // and this device picks the result up through the family listener.
      if (!held) return;
      // Releases the lease as part of its own final metadata write.
      await syncSubscription({ familyId, userId, subscription: sub });
    } catch (err) {
      if (held) {
        // Release even on failure, or a broken feed would block every other
        // device for the length of the lease.
        await releaseSyncLease(familyId, sub.id, {
          lastError: err.message || 'Background sync failed.',
        }).catch(() => {});
      }
    }
  }

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
    if (isFoodRoute)   { foodFabCallback?.(); return; }
    if (isShoppingRoute) { shoppingFabCallback?.(); return; }
    setAdding(true);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <DemoBanner />
      <AddActionContext.Provider value={handleFab}>
        <Outlet context={{ setCreateDefaultDate, setVaultAdd, setHealthFabCallback, setFoodFabCallback, setShoppingFabCallback }} />
      </AddActionContext.Provider>
      <BottomNav onAdd={handleFab} />
      {!isVaultRoute && !isHealthRoute && !isFoodRoute && !isShoppingRoute && (
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
