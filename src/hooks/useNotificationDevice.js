import { useCallback, useEffect, useState } from 'react';
import {
  isDeviceEnabled,
  notificationPermission,
  notificationSupport,
  onNotificationStateChange,
  requestNotificationPermission,
  setDeviceEnabled,
} from '../lib/notifications';

function read() {
  return {
    support: notificationSupport(),
    permission: notificationPermission(),
    enabledHere: isDeviceEnabled(),
  };
}

// This device's notification state. `active` is what the scheduler goes by:
// switched on here and allowed by the browser.
export default function useNotificationDevice() {
  // Starts "off" so the pre-rendered HTML and the first client render agree;
  // the real state is read after mount.
  const [state, setState] = useState({ support: 'unsupported', permission: 'default', enabledHere: false });

  useEffect(() => {
    const refresh = () => setState(read());
    refresh();
    const off = onNotificationStateChange(refresh);
    // The permission can be changed in the browser's own settings while the
    // app is in the background; re-read it on the way back.
    document.addEventListener('visibilitychange', refresh);
    let status;
    navigator.permissions
      ?.query({ name: 'notifications' })
      .then((s) => {
        status = s;
        status.onchange = refresh;
      })
      .catch(() => {});
    return () => {
      off();
      document.removeEventListener('visibilitychange', refresh);
      if (status) status.onchange = null;
    };
  }, []);

  const enable = useCallback(async () => {
    const result =
      notificationPermission() === 'granted' ? 'granted' : await requestNotificationPermission();
    if (result === 'granted') setDeviceEnabled(true);
    return result;
  }, []);

  const disable = useCallback(() => setDeviceEnabled(false), []);

  return {
    ...state,
    active: state.support === 'ok' && state.permission === 'granted' && state.enabledHere,
    enable,
    disable,
  };
}
