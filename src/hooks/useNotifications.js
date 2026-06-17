import { useEffect, useState } from 'react';
import { subscribeNotifications } from '../services/notifications';

export default function useNotifications(familyId) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) {
      setNotifications([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeNotifications(familyId, (list) => {
      setNotifications(list);
      setLoading(false);
    });
    return unsub;
  }, [familyId]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  return { notifications, unreadCount, loading };
}
