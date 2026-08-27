import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Download, RefreshCw } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import ViewToggle from '../components/calendar/ViewToggle';
import FilterChips from '../components/calendar/FilterChips';
import WeekView from '../components/calendar/WeekView';
import MonthView from '../components/calendar/MonthView';
import EventFormModal from '../components/calendar/EventFormModal';
import useAuth from '../hooks/useAuth';
import useT from '../hooks/useT';
import useEvents from '../hooks/useEvents';
import useFamilyMembers from '../hooks/useFamilyMembers';
import { createEvent, deleteEvent, saveFeedAnnotation, updateEvent } from '../services/events';
import { downloadICS } from '../utils/ics';
import { expandEventsInRange } from '../utils/recurrence';
import { isFeedEvent } from '../utils/calendarSync';
import { invalidateFeeds } from '../hooks/useEvents';
import { loadFeed } from '../services/calendarFeeds';

const MEMBER_PALETTE = ['red', 'blue', 'emerald', 'amber', 'violet', 'pink', 'cyan'];

export default function CalendarPage() {
  const { user, userDoc, family } = useAuth();
  const { t } = useT();
  const { events, loading, error } = useEvents(userDoc?.familyId);
  const members = useFamilyMembers();
  const { setCreateDefaultDate } = useOutletContext() || {};
  const [view, setView] = useState('week');
  const [anchor, setAnchor] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [editing, setEditing] = useState(null); // event object or 'new' or null
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [syncing, setSyncing] = useState(false);

  const chips = useMemo(() => [
    { id: 'all', label: t('common.all'), colorKey: 'slate' },
    ...members.map((m, i) => ({
      id: `member:${m.uid}`,
      label: m.displayName,
      colorKey: MEMBER_PALETTE[i % MEMBER_PALETTE.length],
      displayName: m.displayName,
    })),
    ...(family?.kids || []).map((k) => ({
      id: `kid:${k.id}`,
      label: k.name,
      colorKey: k.color,
      kidId: k.id,
    })),
  ], [members, family?.kids, t]);

  // Predicate for the active filter chips, shared by the views and the export.
  const matchesFilters = useMemo(() => {
    if (activeFilters.size === 0) return null;
    const memberNames = chips
      .filter((c) => c.id.startsWith('member:') && activeFilters.has(c.id))
      .map((c) => c.displayName);
    const kidIds = chips
      .filter((c) => c.id.startsWith('kid:') && activeFilters.has(c.id))
      .map((c) => c.kidId);
    return (ev) =>
      memberNames.includes(ev.responsibleParent)
      || (ev.kids || []).some((id) => kidIds.includes(id));
  }, [activeFilters, chips]);

  // Expand recurrences only around the month in view, and key the memo on that
  // month rather than on `anchor` itself: stepping through weeks no longer
  // re-expands every series, and the window is a fraction of the twelve months
  // this used to build up front on every navigation.
  const monthIndex = anchor.getFullYear() * 12 + anchor.getMonth();
  const expandedEvents = useMemo(() => {
    const year = Math.floor(monthIndex / 12);
    const month = monthIndex % 12;
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month + 2, 0, 23, 59, 59);
    return expandEventsInRange(events, from, to);
  }, [events, monthIndex]);

  const filteredEvents = useMemo(
    () => (matchesFilters ? expandedEvents.filter(matchesFilters) : expandedEvents),
    [expandedEvents, matchesFilters],
  );

  function handleToggle(id) {
    if (id === 'all') {
      setActiveFilters(new Set());
      return;
    }
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Push the selected day up to AppShell so the "+" FAB prefills this date.
  useEffect(() => {
    if (!setCreateDefaultDate) return;
    setCreateDefaultDate(selected);
    return () => setCreateDefaultDate(null);
  }, [selected, setCreateDefaultDate]);

  function handleEventClick(ev) {
    if (ev?.isRecurringInstance) {
      const master = events.find((e) => e.id === ev.masterId) || ev;
      setEditing(master);
    } else {
      setEditing(ev);
    }
  }

  async function handleSubmit(values) {
    if (editing && editing !== 'new') {
      // A subscribed calendar is computed from its feed, so its title, time and
      // description cannot be written back. What the family adds on top is
      // stored as an overlay instead.
      if (isFeedEvent(editing)) {
        await saveFeedAnnotation({
          familyId: userDoc.familyId,
          userId: user.uid,
          event: editing,
          values,
        });
        setEditing(null);
        return;
      }
      await updateEvent(editing.id, values);
    } else {
      await createEvent({
        familyId: userDoc.familyId,
        userId: user.uid,
        ...values,
      });
    }
    setEditing(null);
  }

  async function handleDelete() {
    // Feed events have no document to delete; the form hides the button.
    if (!editing || editing === 'new' || isFeedEvent(editing)) return;
    await deleteEvent(editing.id);
    setEditing(null);
  }

  // The export reaches further than the calendar shows, so it expands its own
  // range on demand rather than forcing the views to keep a year of
  // occurrences in memory just in case someone clicks Export.
  function handleExport() {
    if (!events.length) return;
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
    const to = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate(), 23, 59, 59);
    let future = expandEventsInRange(events, from, to);
    if (matchesFilters) future = future.filter(matchesFilters);
    if (!future.length) return;
    downloadICS(future, `family-calendar-${today.toISOString().slice(0, 10)}.ics`, {
      calendarName: family?.name ? `${family.name} (myFAOS)` : 'myFAOS',
    });
  }

  const subs = family?.calendarSubscriptions || [];

  // Feeds are cached for half an hour; this drops the cache and refetches now.
  async function handleSyncAll() {
    if (!subs.length || syncing) return;
    setSyncing(true);
    try {
      await Promise.allSettled(subs.map((sub) => loadFeed(sub, { force: true })));
      invalidateFeeds();
    } finally {
      setSyncing(false);
    }
  }

  const syncButton = subs.length > 0 ? (
    <button
      onClick={handleSyncAll}
      disabled={syncing}
      aria-label={t('calendar.syncExternal')}
      title={t('calendar.syncExternal')}
      className="rounded-full p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
    >
      <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
    </button>
  ) : null;

  const exportButton = (
    <button
      onClick={handleExport}
      aria-label={t('calendar.exportCalendar')}
      title={t('calendar.exportTitle')}
      className="rounded-full p-2 text-slate-600 hover:bg-slate-100"
    >
      <Download size={18} />
    </button>
  );

  const topBarActions = (
    <>
      {syncButton}
      {exportButton}
    </>
  );

  return (
    <>
      <TopBar title={view === 'week' ? t('calendar.thisWeek') : t('calendar.familyCalendar')} right={topBarActions} />
      <main className="mx-auto max-w-md space-y-5 px-5 py-5">
        <ViewToggle value={view} onChange={setView} />
        <FilterChips chips={chips} selected={activeFilters} onToggle={handleToggle} />
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">{t('calendar.loadingEvents')}</p>
        ) : error ? (
          <p className="rounded-xl bg-red-50 px-3 py-4 text-center text-sm text-red-700">
            {t('calendar.loadFailed')}
          </p>
        ) : view === 'week' ? (
          <WeekView
            anchor={anchor}
            selected={selected}
            onAnchorChange={(d) => {
              setAnchor(d);
              setSelected(d);
            }}
            onSelect={setSelected}
            events={filteredEvents}
            onEventClick={handleEventClick}
          />
        ) : (
          <MonthView
            anchor={anchor}
            selected={selected}
            onAnchorChange={(d) => {
              setAnchor(d);
              setSelected(d);
            }}
            onSelect={setSelected}
            events={filteredEvents}
            onEventClick={handleEventClick}
          />
        )}
      </main>

      <EventFormModal
        open={Boolean(editing)}
        initial={editing && editing !== 'new' ? editing : null}
        onClose={() => setEditing(null)}
        onSubmit={handleSubmit}
        onDelete={editing && editing !== 'new' ? handleDelete : undefined}
      />
    </>
  );
}
