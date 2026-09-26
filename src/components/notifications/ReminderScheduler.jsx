import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import useAuth from '../../hooks/useAuth';
import useEvents from '../../hooks/useEvents';
import useTasks from '../../hooks/useTasks';
import useTrackers from '../../hooks/useTrackers';
import useVaccinations from '../../hooks/useVaccinations';
import useT from '../../hooks/useT';
import useNotificationDevice from '../../hooks/useNotificationDevice';
import { collectReminders, dueReminders, nextFireAt, notificationBatch } from '../../utils/reminders';
import { loadSentIds, markSent, showNotification } from '../../lib/notifications';
import { recordDeviceSent, subscribeDeviceSent } from '../../services/pushSubscriptions';

// Upper bound between two checks, so a new day (and with it the day's task,
// vaccination and tracker-goal reminders) is noticed even when nothing is
// scheduled before it.
const MAX_WAIT_MS = 15 * 60 * 1000;

// Sends reminders while the app is open or running in the background. Rendered
// by AppShell only when notifications are active on this device, so the data
// listeners below cost nothing for everyone else -- and they are the same
// queries the pages use, which Firestore serves from one shared listener.
//
// With the app closed, the push sender (scripts/send-reminders.mjs) takes
// over. The two share this device's `sent` record on its push subscription:
// whatever one of them has shown, the other skips. While the app is open this
// side wins on timing, since the sender only runs every ten minutes.
export default function ReminderScheduler() {
  const { user, userDoc, family, isDemo } = useAuth();
  const { pushSubscriptionId } = useNotificationDevice();
  const pushId = isDemo ? null : pushSubscriptionId;
  const { t } = useT();
  const familyId = userDoc?.familyId;
  const { events, loading: eventsLoading } = useEvents(familyId);
  const { tasks, loading: tasksLoading } = useTasks(familyId);
  const { trackers, entries, loading: trackersLoading } = useTrackers(familyId);
  const { vaccinations, loading: vaccinationsLoading } = useVaccinations(familyId);

  // Reminders the sender already pushed to this device. `null` until the
  // first snapshot, so nothing is sent twice while it is still on its way.
  const [pushedHere, setPushedHere] = useState(pushId ? null : {});
  useEffect(() => {
    if (!pushId || !user?.uid) {
      setPushedHere({});
      return undefined;
    }
    setPushedHere(null);
    return subscribeDeviceSent(user.uid, pushId, setPushedHere);
  }, [pushId, user?.uid]);

  const loading =
    eventsLoading || tasksLoading || trackersLoading || vaccinationsLoading || pushedHere === null;

  const [now, setNow] = useState(() => new Date());

  const reminders = useMemo(
    () =>
      collectReminders({
        events,
        tasks,
        trackers,
        trackerEntries: entries,
        vaccinations,
        kids: family?.kids || [],
        me: { uid: user?.uid, displayName: userDoc?.displayName },
        prefs: userDoc?.notificationPrefs,
        now,
      }),
    [events, tasks, trackers, entries, vaccinations, family?.kids, user?.uid, userDoc?.displayName, userDoc?.notificationPrefs, now],
  );

  // Send whatever is due, then sleep until the next reminder (or MAX_WAIT_MS).
  useEffect(() => {
    // Half-loaded data would send "your goal is still open" for a tracker
    // whose entries have not arrived yet.
    if (loading) return undefined;

    const sent = loadSentIds().ids;
    for (const [id, expiresAt] of Object.entries(pushedHere)) {
      if (expiresAt > now.getTime()) sent.add(id);
    }
    const due = dueReminders(reminders, sent, now);
    if (due.length > 0) {
      // Recorded before showing: a second tab running the same check must
      // find these already taken.
      markSent(due);
      if (pushId) recordDeviceSent(user.uid, pushId, due).catch(() => {});
      notificationBatch(due, t, (d) => format(d, 'HH:mm'))
        .forEach((n) => showNotification(n).catch(() => {}));
    }

    const next = nextFireAt(reminders, now);
    const wait = next ? Math.min(Math.max(next - now, 1000), MAX_WAIT_MS) : MAX_WAIT_MS;
    const timer = setTimeout(() => setNow(new Date()), wait);
    return () => clearTimeout(timer);
    // pushedHere and pushId only matter together with a change of reminders
    // or time; reacting to them alone would re-run the check on every write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminders, loading, now, t]);

  // Timers are throttled or frozen in a hidden tab; catch up on return.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return null;
}
