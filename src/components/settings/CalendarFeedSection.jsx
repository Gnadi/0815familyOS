import { useState } from 'react';
import { Copy, Download, Rss, Trash2 } from 'lucide-react';
import Button from '../common/Button';
import useAuth from '../../hooks/useAuth';
import useT from '../../hooks/useT';
import { disableIcsFeed, enableIcsFeed } from '../../services/families';
import { fetchEventsOnce } from '../../services/events';
import { expandEventsInRange } from '../../utils/recurrence';
import { downloadICS } from '../../utils/ics';
import { SITE_URL } from '../../config/site';

// Same window as api/ics-feed.js so download and subscription stay in sync.
const PAST_DAYS = 30;
const FUTURE_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

// Share family events *out* to Google/Apple/Outlook: either a live
// subscription URL (served by /api/ics-feed) or a one-time .ics download.
export default function CalendarFeedSection() {
  const { family } = useAuth();
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const token = family?.icsFeedToken || null;
  const feedUrl = token ? `${SITE_URL}/api/ics-feed?token=${token}` : null;

  async function withBusy(fn) {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err.message || t('calFeed.failed'));
    } finally {
      setBusy(false);
    }
  }

  function handleEnable() {
    if (!family?.id) return;
    withBusy(() => enableIcsFeed(family.id));
  }

  function handleReset() {
    if (!family?.id) return;
    if (!confirm(t('calFeed.resetConfirm'))) return;
    withBusy(() => enableIcsFeed(family.id));
  }

  function handleDisable() {
    if (!family?.id) return;
    if (!confirm(t('calFeed.disableConfirm'))) return;
    withBusy(() => disableIcsFeed(family.id));
  }

  function handleCopy() {
    if (!feedUrl) return;
    navigator.clipboard?.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload() {
    if (!family?.id) return;
    setError('');
    setExportBusy(true);
    try {
      const events = await fetchEventsOnce(family.id);
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
      setExportBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        <Rss size={14} /> {t('calFeed.title')}
      </h2>
      <p className="mt-2 text-sm text-slate-600">{t('calFeed.intro')}</p>

      {!token && (
        <Button onClick={handleEnable} loading={busy} className="mt-4 w-full">
          <Rss size={16} />
          {t('calFeed.enable')}
        </Button>
      )}

      {token && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              {t('calFeed.feedUrl')}
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">
                {feedUrl}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex flex-shrink-0 items-center gap-1 text-sm font-semibold text-brand-600"
              >
                <Copy size={14} /> {copied ? t('calFeed.copied') : t('settings.copy')}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">{t('calFeed.subscribeHint')}</p>
          </div>

          <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {t('calFeed.secretWarning')}
          </p>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleReset} loading={busy} className="flex-1">
              {t('calFeed.reset')}
            </Button>
            <button
              type="button"
              onClick={handleDisable}
              disabled={busy}
              className="flex items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={15} />
              {t('calFeed.disable')}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={handleDownload} loading={exportBusy} className="w-full">
          <Download size={16} />
          {t('calFeed.download')}
        </Button>
        <p className="mt-2 text-xs text-slate-500">{t('calFeed.downloadHint')}</p>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
