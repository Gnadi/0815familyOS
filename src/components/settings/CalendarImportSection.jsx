import { useState } from 'react';
import { CalendarPlus, FileUp, Link as LinkIcon, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import Button from '../common/Button';
import useAuth from '../../hooks/useAuth';
import { parseICS } from '../../utils/icsParser';
import {
  addSubscription,
  fetchRemoteICS,
  importEventsFromParsed,
  removeSubscription,
  syncSubscription,
  updateSubscriptionMeta,
} from '../../services/calendarSubscriptions';
import ProviderInstructions from './ProviderInstructions';

function formatRelative(iso) {
  if (!iso) return 'never';
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} h ago`;
  return `${Math.round(diff / 86_400_000)} d ago`;
}

export default function CalendarImportSection() {
  const { user, userDoc, family } = useAuth();
  const [tab, setTab] = useState('file');

  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        <CalendarPlus size={14} /> Calendar Import
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Bring events from Google, iCloud, Outlook or any iCal source into your
        family calendar.
      </p>

      <div className="mt-4 flex rounded-xl border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab('file')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
            tab === 'file' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileUp size={15} /> One-time file
        </button>
        <button
          type="button"
          onClick={() => setTab('url')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
            tab === 'url' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <LinkIcon size={15} /> Auto-sync URL
        </button>
      </div>

      <div className="mt-4">
        {tab === 'file' ? (
          <FileImportPane familyId={family?.id} userId={user?.uid} />
        ) : (
          <UrlSubscriptionPane
            family={family}
            userId={user?.uid}
            userDoc={userDoc}
          />
        )}
      </div>
    </section>
  );
}

function FileImportPane({ familyId, userId }) {
  const [parsed, setParsed] = useState(null);
  const [skipPast, setSkipPast] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setResult(null);
    try {
      const text = await file.text();
      const out = parseICS(text);
      if (out.events.length === 0) {
        setError('No events found in this file.');
        setParsed(null);
        return;
      }
      setParsed({ ...out, fileName: file.name });
    } catch {
      setError('Could not read this file.');
      setParsed(null);
    }
  }

  async function handleConfirm() {
    if (!parsed || !familyId || !userId) return;
    setBusy(true);
    setError('');
    try {
      const out = await importEventsFromParsed({ familyId, userId, parsed, skipPast });
      setResult(out);
      setParsed(null);
    } catch (err) {
      setError(err.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Export your existing calendar as an <strong>.ics</strong> file and upload
        it here. Re-importing the same file will update events in place — no
        duplicates.
      </p>

      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-600 hover:border-brand-300 hover:bg-brand-50/30">
        <UploadCloud size={22} className="text-slate-400" />
        <span className="font-semibold text-slate-900">
          {parsed ? parsed.fileName : 'Choose .ics file'}
        </span>
        <span className="text-xs text-slate-500">
          {parsed ? `${parsed.events.length} events found` : 'Click to browse'}
        </span>
        <input type="file" accept=".ics,text/calendar" onChange={handleFile} className="hidden" />
      </label>

      {parsed && (
        <div className="rounded-xl bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={skipPast}
              onChange={(e) => setSkipPast(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Skip events from before today
          </label>
          <p className="mt-2 text-xs text-slate-500">
            Recurring events are kept regardless of their original start date.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Imported {result.created} new event{result.created === 1 ? '' : 's'}
          {result.updated > 0 ? `, updated ${result.updated}` : ''}
          {result.skipped > 0 ? `, skipped ${result.skipped} past` : ''}.
        </p>
      )}

      {parsed && (
        <Button onClick={handleConfirm} loading={busy} className="w-full">
          Import {parsed.events.length} events
        </Button>
      )}
    </div>
  );
}

function UrlSubscriptionPane({ family, userId }) {
  const [showHelp, setShowHelp] = useState(true);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const subs = family?.calendarSubscriptions || [];

  async function handleSubscribe(e) {
    e.preventDefault();
    if (!family?.id || !userId) return;
    setError('');
    setBusy(true);
    try {
      const sub = await addSubscription(family.id, { label, url });
      // Run an initial sync so the user immediately sees their events.
      try {
        await syncSubscription({ familyId: family.id, userId, subscription: sub });
      } catch (syncErr) {
        await updateSubscriptionMeta(family.id, sub.id, {
          lastError: syncErr.message || 'Initial sync failed.',
        });
        throw syncErr;
      }
      setLabel('');
      setUrl('');
    } catch (err) {
      setError(err.message || 'Could not subscribe to that calendar.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncNow(sub) {
    if (!family?.id || !userId) return;
    setBusyId(sub.id);
    try {
      await syncSubscription({ familyId: family.id, userId, subscription: sub });
    } catch (err) {
      await updateSubscriptionMeta(family.id, sub.id, {
        lastError: err.message || 'Sync failed.',
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(sub) {
    if (!family?.id) return;
    if (!confirm(`Remove "${sub.label}" and delete its synced events?`)) return;
    setBusyId(sub.id);
    try {
      await removeSubscription(family.id, sub.id);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
        <p className="font-semibold">How auto-sync works</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
          <li>You paste a private iCal link from your existing calendar.</li>
          <li>FamilyOS fetches it now and keeps it refreshed in the background.</li>
          <li>Synced events are <strong>read-only mirrors</strong>: they update or disappear when the source changes. Edit them in the original calendar, not here.</li>
          <li>The link is stored only inside your family. Treat it like a password.</li>
        </ul>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          {showHelp ? 'Hide' : 'Show'} step-by-step guide
        </button>
        {showHelp && (
          <div className="mt-2">
            <ProviderInstructions />
          </div>
        )}
      </div>

      <form onSubmit={handleSubscribe} className="space-y-2 rounded-xl bg-slate-50 p-3">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Mom's Google)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… or webcal://…"
          required
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" loading={busy} className="w-full">
          Test &amp; subscribe
        </Button>
      </form>

      {subs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Active subscriptions
          </p>
          {subs.map((sub) => (
            <div key={sub.id} className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {sub.label}
                  </p>
                  <p className="truncate text-xs text-slate-500">{sub.url}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Last synced: {formatRelative(sub.lastSyncAt)}
                  </p>
                  {sub.lastError && (
                    <p className="mt-1 text-xs text-red-600">⚠ {sub.lastError}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSyncNow(sub)}
                    disabled={busyId === sub.id}
                    aria-label={`Sync ${sub.label} now`}
                    className="rounded-full p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50"
                  >
                    <RefreshCw
                      size={16}
                      className={busyId === sub.id ? 'animate-spin' : ''}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(sub)}
                    disabled={busyId === sub.id}
                    aria-label={`Remove ${sub.label}`}
                    className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
