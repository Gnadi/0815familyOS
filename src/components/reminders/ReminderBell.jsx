import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Cake, CalendarDays, ListChecks, Syringe, X } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import useReminders from '../../hooks/useReminders';
import useSeenReminders from '../../hooks/useSeenReminders';
import useT from '../../hooks/useT';

const ICONS = {
  vaccination: Syringe,
  event: CalendarDays,
  task: ListChecks,
  birthday: Cake,
};

const TONE = {
  vaccination: 'bg-red-50 text-red-500',
  event: 'bg-brand-50 text-brand-600',
  task: 'bg-amber-50 text-amber-600',
  birthday: 'bg-pink-50 text-pink-500',
};

/**
 * The surface myFAOS did not have.
 *
 * Three dashboard widgets each computed what was due and then kept it on the
 * dashboard. This puts the same information — via useReminders, which consumes
 * those same hooks — behind a bell on every screen, with a count of what this
 * device has not seen yet.
 *
 * Not push. See the note in useReminders: real push needs a Cloud Function and
 * therefore the Blaze plan. What is free, and what this does, is an OS
 * notification through the already-registered service worker while a tab is open.
 */
export default function ReminderBell() {
  const reminders = useReminders();
  const { isSeen, markSeen } = useSeenReminders();
  const { t } = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const unseen = reminders.filter((r) => !isSeen(r.id));

  // Anything landing today is worth surfacing outside the tab as well. Fires
  // only while the app is open — there is no server to send it otherwise, and
  // saying so beats implying background delivery that cannot happen.
  const notifiedRef = useRef(new Set());
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const today = new Date();
    for (const r of unseen) {
      if (notifiedRef.current.has(r.id)) continue;
      if (!r.overdue && !isSameDay(new Date(r.date), today)) continue;
      notifiedRef.current.add(r.id);
      navigator.serviceWorker?.ready
        ?.then((reg) => reg.showNotification(t('reminders.title'), { body: r.title, tag: r.id }))
        .catch(() => {});
    }
  }, [unseen, t]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!panelRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function handleOpen() {
    setOpen((v) => !v);
    // Opening the list is what counts as having seen it. Marked on open rather
    // than on close so the badge clears immediately, which is what a reader
    // expects — and the entries stay visible while the panel is up.
    if (!open) markSeen(unseen.map((r) => r.id));
  }

  function describe(r) {
    if (r.kind === 'birthday') {
      const when =
        r.daysUntil === 0
          ? t('dashboard.bdToday')
          : r.daysUntil === 1
            ? t('dashboard.bdTomorrow')
            : t('dashboard.bdInDays', { days: r.daysUntil });
      return t('reminders.birthdayBody', { age: r.turning, when });
    }
    if (r.kind === 'vaccination') {
      return r.overdue
        ? t('reminders.vaccOverdue', { name: r.personName || t('dashboard.childFallback') })
        : t('reminders.vaccDue', {
            name: r.personName || t('dashboard.childFallback'),
            date: format(new Date(r.date), 'd MMM'),
          });
    }
    if (r.kind === 'event') return t('reminders.eventToday');
    return t('reminders.taskToday');
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={t('reminders.title')}
        aria-expanded={open}
        className="relative rounded-full p-1.5 text-slate-600 hover:bg-slate-100"
      >
        <Bell size={20} />
        {unseen.length > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            {unseen.length > 9 ? '9+' : unseen.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-30 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-900">{t('reminders.title')}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('common.close')}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
            >
              <X size={14} />
            </button>
          </div>

          {reminders.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">{t('reminders.empty')}</p>
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {reminders.map((r) => {
                const Icon = ICONS[r.kind] ?? Bell;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        navigate(r.to);
                      }}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                    >
                      <span
                        className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${TONE[r.kind] ?? 'bg-slate-100 text-slate-500'}`}
                      >
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {r.title}
                        </span>
                        <span className="block text-xs text-slate-500">{describe(r)}</span>
                      </span>
                      {r.overdue && (
                        <span className="mt-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">
                          {t('reminders.overdue')}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Stated rather than implied: nothing arrives while the app is shut. */}
          <p className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-[11px] leading-snug text-slate-500">
            {t('reminders.foreground')}
          </p>
        </div>
      )}
    </div>
  );
}
