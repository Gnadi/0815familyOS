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
  migrateMirroredSubscriptionEvents,
} from '../../services/calendarSubscriptions';

// Let the app finish loading before any background housekeeping runs.
const HOUSEKEEPING_DELAY_MS = 4000;

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

  // Subscribed calendars are computed from their .ics feeds at render time and
  // are not stored, so there is no sync to run here. What is left is one-off
  // housekeeping: retire the mirrored copies the old sync wrote, and drop
  // annotations belonging to subscriptions that no longer exist.
  //
  // Both are free when there is nothing to do -- they inspect the events the
  // live listener already holds and stop there.
  const tidiedThisSession = useRef(null);
  useEffect(() => {
    if (!family?.id || !user?.uid) return undefined;
    const familyId = family.id;
    if (tidiedThisSession.current === familyId) return undefined;

    const timer = setTimeout(async () => {
      tidiedThisSession.current = familyId;
      const existingEvents = peekEvents(familyId);
      try {
        await migrateMirroredSubscriptionEvents(familyId, { userId: user.uid, existingEvents });
        await cleanupOrphanedSubscriptionEvents(familyId, { existingEvents: peekEvents(familyId) });
      } catch {
        // Housekeeping is best-effort; it retries next session.
      }
    }, HOUSEKEEPING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [family?.id, user?.uid]);

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
