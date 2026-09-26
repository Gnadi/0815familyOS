import { useEffect } from 'react';
import useAuth from '../../hooks/useAuth';
import useNotificationDevice from '../../hooks/useNotificationDevice';
import useT from '../../hooks/useT';
import { pushSupported, removePushSubscription, syncPushSubscription } from '../../services/pushSubscriptions';

// Keeps this device's push subscription in step with its reminder switch:
// subscribed while reminders are on here, removed once they are switched off
// or the browser's permission is withdrawn. Re-syncing on every start also
// refreshes the stored time zone and language, which the sender writes by.
export default function PushSubscriptionSync() {
  const { user, isDemo } = useAuth();
  const { locale } = useT();
  const { ready, active, pushSubscriptionId } = useNotificationDevice();
  const uid = user?.uid;

  useEffect(() => {
    // `ready`: before the device state has been read, "not active" only means
    // "not known yet", and acting on it would unsubscribe every start.
    if (!ready || isDemo || !uid || !pushSupported()) return;
    if (active) {
      syncPushSubscription(uid, { locale }).catch((err) => {
        console.warn('Push subscription failed:', err);
      });
    } else if (pushSubscriptionId) {
      removePushSubscription(uid).catch(() => {});
    }
    // pushSubscriptionId is read, not reacted to: syncing sets it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, active, isDemo, uid, locale]);

  return null;
}
