import { format, isToday, isYesterday } from 'date-fns';
import { Pencil, Plus } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import useT from '../../hooks/useT';
import { trackerColor } from '../../constants/trackerPresets';
import { groupEntriesByDay } from '../../utils/tracker';

const HISTORY_LIMIT = 60;

function dayLabel(day, t) {
  if (!day) return t('tracker.unknownDay');
  if (isToday(day)) return t('tracker.today');
  if (isYesterday(day)) return t('tracker.yesterday');
  return format(day, 'EEEE, d MMM yyyy');
}

export default function TrackerDetailModal({
  open,
  onClose,
  tracker,
  status,
  kidName,
  onAddEntry,
  onEditEntry,
  onEditTracker,
}) {
  const { t } = useT();
  if (!tracker) return null;

  const color = trackerColor(tracker.color);
  // The sheet is a history view, not an archive: older entries stay in
  // Firestore and in the family export, they just aren't rendered here.
  const shown = status.entries.slice(0, HISTORY_LIMIT);
  const groups = groupEntriesByDay(shown);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${tracker.emoji} ${tracker.name}`}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => onEditTracker(tracker)} className="flex-1">
            <Pencil size={16} />
            {t('tracker.editTracker')}
          </Button>
          <Button onClick={() => onAddEntry(tracker)} className="flex-1">
            <Plus size={16} />
            {t('tracker.addEntry')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className={`rounded-2xl px-4 py-3 ${color.soft}`}>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
            {t('tracker.forChild', { name: kidName })}
          </p>
          <p className="mt-1 text-sm font-medium">
            {status.lastAt
              ? t('tracker.lastEntryAt', { date: format(status.lastAt, 'EEE d MMM, HH:mm') })
              : t('tracker.neverLogged')}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span>{t('tracker.statToday', { count: status.todayCount })}</span>
            {status.hasGoal && <span>{t('tracker.statGoal', { goal: status.goal })}</span>}
            {status.todaySum != null && (
              <span>{t('tracker.todayTotal', { value: status.todaySum, unit: tracker.unit || '' }).trim()}</span>
            )}
            {tracker.minIntervalHours && (
              <span>{t('tracker.statInterval', { hours: tracker.minIntervalHours })}</span>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-900">{t('tracker.history')}</h3>
          {groups.length === 0 ? (
            <p className="mt-3 rounded-xl bg-slate-50 py-6 text-center text-sm text-slate-400">
              {t('tracker.noEntries')}
            </p>
          ) : (
            <div className="mt-2 space-y-4">
              {groups.map((group) => (
                <div key={group.key}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {dayLabel(group.day, t)}
                  </p>
                  <div className="mt-1.5 divide-y divide-slate-100 overflow-hidden rounded-xl bg-slate-50">
                    {group.entries.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => onEditEntry(entry)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-100"
                      >
                        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${color.dot}`} />
                        <span className="w-12 flex-shrink-0 text-sm font-semibold text-slate-900">
                          {entry.at ? format(entry.at, 'HH:mm') : '—'}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                          {entry.note || t('tracker.noNote')}
                        </span>
                        {entry.value != null && (
                          <span className="flex-shrink-0 text-xs font-semibold text-slate-700">
                            {entry.value}
                            {tracker.unit ? ` ${tracker.unit}` : ''}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {status.entries.length > HISTORY_LIMIT && (
                <p className="text-center text-xs text-slate-400">
                  {t('tracker.historyTruncated', { count: HISTORY_LIMIT })}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
