import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import useAuth from '../../hooks/useAuth';
import useEvents from '../../hooks/useEvents';
import useTasks from '../../hooks/useTasks';
import useTrackers from '../../hooks/useTrackers';
import useVaccinations from '../../hooks/useVaccinations';
import useT from '../../hooks/useT';
import { collectReminders, dueReminders, nextFireAt, reminderText } from '../../utils/reminders';
import { loadSentIds, markSent, showNotification } from '../../lib/notifications';

// Upper bound between two checks, so a new day (and with it the day's task,
// vaccination and tracker-goal reminders) is noticed even when nothing is
// scheduled before it.
const MAX_WAIT_MS = 15 * 60 * 1000;
// More reminders due at once than this (the first check after a night offline,
// say) arrive as one summary instead of a burst.
const MAX_SEPARATE = 3;

// Sends reminders while the app is open or running in the background. Rendered
// by AppShell only when notifications are active on this device, so the data
// listeners below cost nothing for everyone else -- and they are the same
// queries the pages use, which Firestore serves from one shared listener.
export default function ReminderScheduler() {
  const { user, userDoc, family } = useAuth();
  const { t } = useT();
  const familyId = userDoc?.familyId;
  const { events, loading: eventsLoading } = useEvents(familyId);
  const { tasks, loading: tasksLoading } = useTasks(familyId);
  const { trackers, entries, loading: trackersLoading } = useTrackers(familyId);
  const { vaccinations, loading: vaccinationsLoading } = useVaccinations(familyId);
  const loading = eventsLoading || tasksLoading || trackersLoading || vaccinationsLoading;

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

    const due = dueReminders(reminders, loadSentIds().ids, now);
    if (due.length > 0) {
      // Recorded before showing: a second tab running the same check must
      // find these already taken.
      markSent(due);
      const time = (d) => format(d, 'HH:mm');
      const texts = due.map((r) => ({ ...reminderText(r, t, time), tag: r.id, url: r.url }));
      const batch =
        texts.length > MAX_SEPARATE
          ? [{
              title: t('notifications.summaryTitle', { count: texts.length }),
              body: texts.map((x) => x.title).join(' · '),
              tag: 'summary',
              url: '/dashboard',
            }]
          : texts;
      batch.forEach((n) => showNotification(n).catch(() => {}));
    }

    const next = nextFireAt(reminders, now);
    const wait = next ? Math.min(Math.max(next - now, 1000), MAX_WAIT_MS) : MAX_WAIT_MS;
    const timer = setTimeout(() => setNow(new Date()), wait);
    return () => clearTimeout(timer);
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
