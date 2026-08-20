import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Activity, Undo2 } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';
import TrackerCard from '../components/tracker/TrackerCard';
import TrackerFormModal from '../components/tracker/TrackerFormModal';
import TrackerDetailModal from '../components/tracker/TrackerDetailModal';
import LogEntryModal from '../components/tracker/LogEntryModal';
import useAuth from '../hooks/useAuth';
import useT from '../hooks/useT';
import useTrackers from '../hooks/useTrackers';
import {
  createTracker,
  deleteTracker,
  deleteTrackerEntry,
  logTrackerEntry,
  updateTracker,
  updateTrackerEntry,
} from '../services/trackers';
import { trackerStatus } from '../utils/tracker';

// Relative labels ("3 h ago") go stale while the page sits open on a phone, so
// the clock the statuses are derived from ticks on its own.
const TICK_MS = 30000;
const UNDO_MS = 6000;

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500" />
    </div>
  );
}

export default function TrackerPage() {
  const navigate = useNavigate();
  const { setTrackerFabCallback } = useOutletContext();
  const { user, userDoc, family } = useAuth();
  const { t } = useT();

  const kids = family?.kids ?? [];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [now, setNow] = useState(() => new Date());

  const { trackers, entries, loading } = useTrackers(userDoc?.familyId);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTracker, setEditingTracker] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [logTarget, setLogTarget] = useState(null); // { tracker, entry } | null
  const [undo, setUndo] = useState(null); // { entryId, name }

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Removing a child in Settings shrinks the list under us; without this the
  // selected tab can point past the end and every read of `currentKid` below
  // would hit null.
  useEffect(() => {
    if (selectedIdx > 0 && selectedIdx >= kids.length) setSelectedIdx(0);
  }, [kids.length, selectedIdx]);

  const openNewTracker = useCallback(() => {
    setEditingTracker(null);
    setFormOpen(true);
  }, []);

  useEffect(() => {
    setTrackerFabCallback(() => openNewTracker);
    return () => setTrackerFabCallback(null);
  }, [setTrackerFabCallback, openNewTracker]);

  useEffect(() => {
    if (!undo) return undefined;
    const id = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(id);
  }, [undo]);

  const currentKid = kids[selectedIdx] ?? null;

  const kidTrackers = useMemo(
    () => (currentKid ? trackers.filter((tr) => tr.kidIds.includes(currentKid.id)) : []),
    [trackers, currentKid],
  );

  const statuses = useMemo(() => {
    const map = new Map();
    for (const tracker of kidTrackers) {
      map.set(tracker.id, trackerStatus(tracker, entries, currentKid?.id, now));
    }
    return map;
  }, [kidTrackers, entries, currentKid?.id, now]);

  const detailTracker = kidTrackers.find((tr) => tr.id === detailId) ?? null;

  // One tap logs "now". Trackers that carry a number can't be logged blind, so
  // those open the entry sheet instead.
  async function handleQuickLog(tracker) {
    if (!currentKid) return;
    if (tracker.trackValue) {
      setLogTarget({ tracker, entry: null });
      return;
    }
    const ref = await logTrackerEntry({
      familyId: userDoc.familyId,
      userId: user.uid,
      trackerId: tracker.id,
      kidId: currentKid.id,
      at: new Date(),
    });
    setNow(new Date());
    setUndo({ entryId: ref?.id, name: tracker.name });
  }

  async function handleUndo() {
    if (undo?.entryId) await deleteTrackerEntry(undo.entryId);
    setUndo(null);
  }

  async function handleTrackerSubmit(values) {
    if (editingTracker?.id) {
      await updateTracker(editingTracker.id, values);
    } else {
      await createTracker({
        familyId: userDoc.familyId,
        userId: user.uid,
        order: trackers.length,
        ...values,
      });
    }
    setFormOpen(false);
    setEditingTracker(null);
  }

  async function handleTrackerDelete() {
    await deleteTracker(editingTracker.id, userDoc.familyId);
    setFormOpen(false);
    setEditingTracker(null);
    setDetailId(null);
  }

  async function handleEntrySubmit(values) {
    const { tracker, entry } = logTarget;
    if (entry?.id) {
      await updateTrackerEntry(entry.id, values);
    } else {
      await logTrackerEntry({
        familyId: userDoc.familyId,
        userId: user.uid,
        trackerId: tracker.id,
        kidId: currentKid.id,
        ...values,
      });
    }
    setNow(new Date());
    setLogTarget(null);
  }

  async function handleEntryDelete() {
    await deleteTrackerEntry(logTarget.entry.id);
    setLogTarget(null);
  }

  if (!loading && kids.length === 0) {
    return (
      <>
        <TopBar title={t('tracker.title')} onBack={() => navigate('/dashboard')} />
        <main className="mx-auto max-w-md px-5 py-16 text-center">
          <p className="text-2xl">📈</p>
          <p className="mt-3 text-base font-semibold text-slate-900">{t('tracker.noKids')}</p>
          <p className="mt-1 text-sm text-slate-500">{t('tracker.noKidsDesc')}</p>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title={t('tracker.title')} onBack={() => navigate('/dashboard')} />
      <main className="mx-auto max-w-md space-y-5 px-5 py-6">
        <p className="text-sm text-slate-500">{t('tracker.subtitle')}</p>

        {/* Child tabs — kids themselves are managed in Settings → Family. */}
        <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
          {kids.map((kid, idx) => (
            <button
              key={kid.id}
              onClick={() => setSelectedIdx(idx)}
              className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                selectedIdx === idx
                  ? 'bg-white font-semibold text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {kid.name}
            </button>
          ))}
        </div>

        {loading ? (
          <Spinner />
        ) : kidTrackers.length === 0 ? (
          <EmptyState
            icon={Activity}
            title={t('tracker.emptyTitle', { name: currentKid?.name ?? '' })}
            description={t('tracker.emptyDesc')}
            action={
              <Button size="sm" onClick={openNewTracker}>
                {t('tracker.createFirst')}
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {kidTrackers.map((tracker) => (
              <TrackerCard
                key={tracker.id}
                tracker={tracker}
                status={statuses.get(tracker.id)}
                onLog={handleQuickLog}
                onOpen={(tr) => setDetailId(tr.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Undo bar. A mis-tap on a one-tap logger is the likeliest mistake in
          this screen, and it sits above the bottom nav so it never covers it. */}
      {undo && (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-5">
          <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-lg">
            <span className="min-w-0 flex-1 truncate text-sm">
              {t('tracker.logged', { name: undo.name })}
            </span>
            <button
              type="button"
              onClick={handleUndo}
              className="flex flex-shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-300"
            >
              <Undo2 size={15} />
              {t('tracker.undo')}
            </button>
          </div>
        </div>
      )}

      <TrackerFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingTracker(null);
        }}
        onSubmit={handleTrackerSubmit}
        onDelete={editingTracker?.id ? handleTrackerDelete : undefined}
        initial={editingTracker}
        kids={kids}
        defaultKidId={currentKid?.id}
      />

      <TrackerDetailModal
        open={Boolean(detailTracker)}
        onClose={() => setDetailId(null)}
        tracker={detailTracker}
        status={detailTracker ? statuses.get(detailTracker.id) : null}
        kidName={currentKid?.name ?? ''}
        onAddEntry={(tracker) => setLogTarget({ tracker, entry: null })}
        onEditEntry={(entry) => setLogTarget({ tracker: detailTracker, entry })}
        onEditTracker={(tracker) => {
          setDetailId(null);
          setEditingTracker(tracker);
          setFormOpen(true);
        }}
      />

      <LogEntryModal
        open={Boolean(logTarget)}
        onClose={() => setLogTarget(null)}
        onSubmit={handleEntrySubmit}
        onDelete={logTarget?.entry?.id ? handleEntryDelete : undefined}
        tracker={logTarget?.tracker}
        initial={logTarget?.entry}
        kidName={currentKid?.name ?? ''}
      />
    </>
  );
}
