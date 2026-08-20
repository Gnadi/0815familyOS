import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Check, ChevronRight, Plus, Timer } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import useT from '../../hooks/useT';
import useTrackers from '../../hooks/useTrackers';
import TrackerUndoBar from '../tracker/TrackerUndoBar';
import { trackerColor } from '../../constants/trackerPresets';
import { activeTrackerRows } from '../../utils/tracker';
import { deleteTrackerEntry, logTrackerEntry } from '../../services/trackers';

// Enough to answer "what still needs doing?" without the Dashboard turning
// into the Tracker page; the rest are one tap away behind "See all".
const MAX_ROWS = 4;
const TICK_MS = 30000;
const UNDO_MS = 6000;

const SINCE_KEY = {
  now: 'tracker.justNow',
  minute: 'tracker.agoMinutes',
  hour: 'tracker.agoHours',
  day: 'tracker.agoDays',
  soon: 'tracker.justNow',
};

function statusLine(status, { t, tn }) {
  if (status.hasGoal) {
    return t('tracker.todayProgress', { count: status.todayCount, goal: status.goal });
  }
  if (!status.lastAt) return t('tracker.neverLogged');
  const { unit, count } = status.since;
  const ago = unit === 'now' || unit === 'soon' ? t(SINCE_KEY.now) : tn(SINCE_KEY[unit], count);
  return `${t('tracker.lastLabel')} ${ago}`;
}

export default function ActiveTrackers() {
  const { user, userDoc, family } = useAuth();
  const { t, tn } = useT();
  const { trackers, entries, loading } = useTrackers(userDoc?.familyId);
  const [now, setNow] = useState(() => new Date());
  const [undo, setUndo] = useState(null);

  // Relative labels go stale while the Dashboard sits open on a phone.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!undo) return undefined;
    const id = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(id);
  }, [undo]);

  const rows = useMemo(
    () => activeTrackerRows(trackers, entries, family?.kids ?? [], now),
    [trackers, entries, family?.kids, now],
  );

  // Nothing set up yet is not a Dashboard concern — the widget simply steps
  // aside, exactly like Health Alerts does with no due vaccinations.
  if (loading || rows.length === 0) return null;

  async function handleLog(row) {
    const ref = await logTrackerEntry({
      familyId: userDoc.familyId,
      userId: user.uid,
      trackerId: row.tracker.id,
      kidId: row.kid.id,
      at: new Date(),
    });
    setNow(new Date());
    setUndo({ entryId: ref?.id, name: `${row.kid.name} · ${row.tracker.name}` });
  }

  async function handleUndo() {
    if (undo?.entryId) await deleteTrackerEntry(undo.entryId);
    setUndo(null);
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">{t('dashboard.activeTrackers')}</h2>
        <Link to="/tracker" className="flex items-center gap-0.5 text-sm font-semibold text-brand-600">
          {t('dashboard.seeAll')}
          <ChevronRight size={15} />
        </Link>
      </div>

      <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-card">
        {rows.slice(0, MAX_ROWS).map(({ key, kid, tracker, status }) => {
          const color = trackerColor(tracker.color);
          return (
            <div key={key} className="flex items-center gap-3 px-4 py-3">
              <Link to="/tracker" className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className={`relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-base ${color.bubble}`}
                >
                  {tracker.emoji}
                  {status.goalMet && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
                      <Check size={9} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {kid.name} · {tracker.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="truncate">{statusLine(status, { t, tn })}</span>
                    {status.cooldownActive && (
                      <span className="inline-flex flex-shrink-0 items-center gap-0.5 font-medium text-amber-700">
                        <Timer size={10} />
                        {format(status.cooldownUntil, 'HH:mm')}
                      </span>
                    )}
                  </span>
                </span>
              </Link>

              {/* Trackers that record a number can't be logged blind, so those
                  hand off to the Tracker page and its entry sheet. */}
              {tracker.trackValue ? (
                <Link
                  to="/tracker"
                  aria-label={t('tracker.logNow', { name: tracker.name })}
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white ${color.button}`}
                >
                  <Plus size={18} />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => handleLog({ kid, tracker })}
                  aria-label={t('tracker.logNow', { name: tracker.name })}
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white transition active:scale-95 ${color.button}`}
                >
                  <Plus size={18} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {undo && <TrackerUndoBar name={undo.name} onUndo={handleUndo} />}
    </section>
  );
}
