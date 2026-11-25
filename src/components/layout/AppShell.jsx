import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

  // Pages register their own "+" behaviour (and the calendar its selected
  // day) through the outlet context. These live in refs, not state: nothing
  // renders from them until the "+" is pressed, so storing them must not
  // re-render the whole shell -- and with it the page that just registered.
  // Each setter mimics a React state setter (value or updater function), which
  // is how the pages call them: `setX(() => fn)`.
  const fabRefs = useRef({
    createDefaultDate: null,
    vault: null,
    health: null,
    tracker: null,
    food: null,
    shopping: null,
  });
  const outletContext = useMemo(() => {
    const setterFor = (name) => (value) => {
      const prev = fabRefs.current[name];
      fabRefs.current[name] = typeof value === 'function' ? value(prev) : value;
    };
    return {
      // DocumentVaultPage: opens its own upload modal.
      setVaultAdd: setterFor('vault'),
      // VaccinationPage: opens its own add-vaccination modal.
      setHealthFabCallback: setterFor('health'),
      // TrackerPage: the shared "+" creates a new tracker.
      setTrackerFabCallback: setterFor('tracker'),
      // FoodPage: depends on its active tab (recipe vs. meal).
      setFoodFabCallback: setterFor('food'),
      // ShoppingPage: focuses its add field.
      setShoppingFabCallback: setterFor('shopping'),
      // CalendarPage: the day new events default to.
      setCreateDefaultDate: setterFor('createDefaultDate'),
    };
  }, []);

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

  // Read the route from a ref so the handler (the AddActionContext value) keeps
  // one identity and route changes don't re-render every consumer.
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const handleFab = useCallback(() => {
    const path = pathRef.current;
    const cb = fabRefs.current;
    if (path.startsWith('/vault'))    { cb.vault?.(); return; }
    if (path.startsWith('/health'))   { cb.health?.(); return; }
    if (path.startsWith('/tracker'))  { cb.tracker?.(); return; }
    if (path.startsWith('/meals'))    { cb.food?.(); return; }
    if (path.startsWith('/shopping')) { cb.shopping?.(); return; }
    setAdding(true);
  }, []);
  const closeAdding = useCallback(() => setAdding(false), []);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <DemoBanner />
      <AddActionContext.Provider value={handleFab}>
        <Outlet context={outletContext} />
      </AddActionContext.Provider>
      <BottomNav onAdd={handleFab} />
      {/* Mounted only while open: a closed form would otherwise keep its data
          hooks (events, members) alive and re-render on every snapshot. */}
      {adding && !isVaultRoute && !isHealthRoute && !isTrackerRoute && !isFoodRoute && !isShoppingRoute && (
        isGiftsRoute ? (
          <GiftFormModal
            open
            onClose={closeAdding}
            onSubmit={handleCreateGift}
            recipients={[...(family?.kids ?? []), ...(family?.giftRecipients ?? [])]}
          />
        ) : isTasksRoute ? (
          <TaskFormModal
            open
            onClose={closeAdding}
            onSubmit={handleCreateTask}
          />
        ) : (
          <EventFormModal
            open
            onClose={closeAdding}
            onSubmit={handleCreateEvent}
            initialDate={fabRefs.current.createDefaultDate}
          />
        )
      )}
    </div>
  );
}
