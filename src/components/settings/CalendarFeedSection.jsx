import { useState } from 'react';
import { Download } from 'lucide-react';
import Button from '../common/Button';
import useAuth from '../../hooks/useAuth';
import useT from '../../hooks/useT';
import { fetchCalendarOnce } from '../../services/events';
import { expandEventsInRange } from '../../utils/recurrence';
import { downloadICS } from '../../utils/ics';

// Export window: a month of history plus a year ahead. Recurring events are
// expanded into concrete occurrences so they import correctly everywhere.
const PAST_DAYS = 30;
const FUTURE_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

// One-time .ics export of the family calendar for importing into
// Google/Apple/Outlook. Runs entirely client-side.
export default function CalendarFeedSection() {
  const { family } = useAuth();
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleDownload() {
    if (!family?.id) return;
    setError('');
    setBusy(true);
    try {
      // Subscribed calendars are not stored, so the export computes them the
      // same way the app renders them.
      const events = await fetchCalendarOnce(family.id, family.calendarSubscriptions);
      const now = Date.now();
      const expanded = expandEventsInRange(
        events,
        new Date(now - PAST_DAYS * DAY_MS),
        new Date(now + FUTURE_DAYS * DAY_MS),
      );
      downloadICS(expanded, 'family-calendar.ics', { calendarName: family.name });
    } catch (err) {
      setError(err.message || t('calFeed.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        <Download size={14} /> {t('calFeed.title')}
      </h2>
      <p className="mt-2 text-sm text-slate-600">{t('calFeed.intro')}</p>
      <Button variant="secondary" onClick={handleDownload} loading={busy} className="mt-4 w-full">
        <Download size={16} />
        {t('calFeed.download')}
      </Button>
      <p className="mt-2 text-xs text-slate-500">{t('calFeed.downloadHint')}</p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
