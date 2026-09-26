import { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import Button from '../common/Button';
import useAuth from '../../hooks/useAuth';
import useNotificationDevice from '../../hooks/useNotificationDevice';
import useT from '../../hooks/useT';
import { updateUserDoc } from '../../services/users';
import { showNotification } from '../../lib/notifications';
import {
  EVENT_LEAD_MINUTES,
  EVENT_SCOPES,
  normalizeNotificationPrefs,
} from '../../utils/reminders';

const SELECT_CLASS =
  'w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-900 focus:border-brand-400 focus:ring-2 focus:ring-brand-100';

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
    </label>
  );
}

// Reminders: switched on per device, configured per member. The "what" is
// stored on the user document so it follows the member to every device.
export default function NotificationSettingsSection() {
  const { user, userDoc } = useAuth();
  const { t } = useT();
  const device = useNotificationDevice();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const prefs = normalizeNotificationPrefs(userDoc?.notificationPrefs);

  async function savePrefs(patch) {
    setError('');
    try {
      await updateUserDoc(user.uid, { notificationPrefs: { ...prefs, ...patch } });
    } catch (err) {
      setError(err.message || t('notifications.saveFailed'));
    }
  }

  async function handleEnable() {
    setError('');
    setBusy(true);
    try {
      const result = await device.enable();
      if (result !== 'granted') setError(t('notifications.permissionDenied'));
    } catch (err) {
      setError(err.message || t('notifications.permissionDenied'));
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setError('');
    try {
      await showNotification({
        title: t('notifications.testTitle'),
        body: t('notifications.testBody'),
        tag: 'test',
        url: '/settings',
      });
    } catch (err) {
      setError(err.message || t('notifications.testFailed'));
    }
  }

  let status;
  if (device.support === 'needsInstall') status = t('notifications.needsInstall');
  else if (device.support === 'unsupported') status = t('notifications.unsupported');
  else if (device.permission === 'denied') status = t('notifications.blocked');

  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        <Bell size={14} /> {t('notifications.title')}
      </h2>
      <p className="mt-2 text-sm text-slate-600">{t('notifications.intro')}</p>

      {status ? (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{status}</p>
      ) : device.active ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" onClick={handleTest} className="flex-1">
            <Bell size={16} /> {t('notifications.test')}
          </Button>
          <Button variant="ghost" onClick={device.disable} className="flex-1">
            <BellOff size={16} /> {t('notifications.disable')}
          </Button>
        </div>
      ) : (
        <Button onClick={handleEnable} loading={busy} className="mt-4 w-full">
          <Bell size={16} /> {t('notifications.enable')}
        </Button>
      )}

      <p className="mt-5 text-sm font-medium text-slate-700">{t('notifications.remindMeOf')}</p>
      <div className="mt-2 space-y-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <label htmlFor="notif-events" className="text-sm font-medium text-slate-700">
            {t('notifications.events')}
          </label>
          <div className={`mt-2 grid gap-2 ${prefs.events !== 'off' ? 'sm:grid-cols-2' : ''}`}>
            <select
              id="notif-events"
              value={prefs.events}
              onChange={(e) => savePrefs({ events: e.target.value })}
              className={SELECT_CLASS}
            >
              {EVENT_SCOPES.map((scope) => (
                <option key={scope} value={scope}>{t(`notifications.eventScope.${scope}`)}</option>
              ))}
            </select>
            {prefs.events !== 'off' && (
              <select
                aria-label={t('notifications.leadTime')}
                value={prefs.eventLeadMinutes}
                onChange={(e) => savePrefs({ eventLeadMinutes: Number(e.target.value) })}
                className={SELECT_CLASS}
              >
                {EVENT_LEAD_MINUTES.map((m) => (
                  <option key={m} value={m}>{t('notifications.minutesBefore', { count: m })}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <Toggle label={t('notifications.trackers')} checked={prefs.trackers} onChange={(v) => savePrefs({ trackers: v })} />
        <Toggle label={t('notifications.tasks')} checked={prefs.tasks} onChange={(v) => savePrefs({ tasks: v })} />
        <Toggle label={t('notifications.vaccinations')} checked={prefs.vaccinations} onChange={(v) => savePrefs({ vaccinations: v })} />
      </div>

      <p className="mt-3 text-xs text-slate-500">{t('notifications.whileOpenHint')}</p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
