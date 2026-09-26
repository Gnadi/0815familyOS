import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useOutletContext } from 'react-router-dom';
import { CalendarClock, Download, List, RefreshCw } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import ViewToggle from '../components/calendar/ViewToggle';
import FilterChips from '../components/calendar/FilterChips';
import EventSearchBar from '../components/calendar/EventSearchBar';
import FeedIssueBanner from '../components/calendar/FeedIssueBanner';
import SearchResults from '../components/calendar/SearchResults';
import WeekView from '../components/calendar/WeekView';
import MonthView from '../components/calendar/MonthView';
import EventFormModal from '../components/calendar/EventFormModal';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import useAuth from '../hooks/useAuth';
import useT from '../hooks/useT';
import useEvents from '../hooks/useEvents';
import useUIPreferences from '../hooks/useUIPreferences';
import useFamilyMembers from '../hooks/useFamilyMembers';
import useCategories from '../hooks/useCategories';
import { tLabel } from '../i18n/labels';
import {
  createEvent,
  deleteEvent,
  detachOccurrence,
  excludeOccurrence,
  saveFeedAnnotation,
  updateEvent,
} from '../services/events';
import { downloadICS } from '../utils/ics';
import { expandEventsInRange, isValidRecurrence } from '../utils/recurrence';
import { eventEnd } from '../utils/eventTime';
import { formatDate } from '../utils/date';
import { EMPTY_SEARCH_RESULT, searchEvents } from '../utils/eventSearch';
import { isFeedEvent } from '../utils/calendarSync';
import { invalidateFeeds } from '../hooks/useEvents';
import { loadFeed } from '../services/calendarFeeds';

const MEMBER_PALETTE = ['red', 'blue', 'emerald', 'amber', 'violet', 'pink', 'cyan'];

export default function CalendarPage() {
  const { user, userDoc, family } = useAuth();
  const { t } = useT();
  const { events, loading, error, feedErrors, feedReports } = useEvents(userDoc?.familyId);
  const { showDayTimeline, setShowDayTimeline } = useUIPreferences();
  const members = useFamilyMembers();
  const { get: getCategory } = useCategories();
  const { setCreateDefaultDate } = useOutletContext() || {};
  const [view, setView] = useState('week');
  const [anchor, setAnchor] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  // What the form is open for, or null:
  //   { mode: 'new', date }                     -- a new event (from the timeline)
  //   { mode: 'event', event }                  -- an event, or a whole series
  //   { mode: 'occurrence', event, master }     -- one date of a series on its own
  const [editing, setEditing] = useState(null);
  // A tapped occurrence of a series, waiting for "only this one or all?".
  const [scopeFor, setScopeFor] = useState(null);
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');

  const searchQuery = search.trim();
  const isSearching = searchQuery.length > 0;

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

  // Category and kid are ids on an event; search only becomes useful once they
  // are the words the family actually reads on screen.
  const searchContext = useMemo(() => ({
    categoryLabel: (id) => tLabel(t, getCategory(id)),
    kidName: (id) => (family?.kids || []).find((k) => k.id === id)?.name || '',
  }), [t, getCategory, family?.kids]);

  // Search runs over the unexpanded events -- the family's own, the ones
  // imported from an .ics file and the ones computed from subscribed calendars
  // alike, since `useEvents` hands them over as one list. It deliberately does
  // not reuse `expandedEvents`: that window is the month in view, and a search
  // that only finds what is already on screen is no search at all.
  const searchResults = useMemo(() => {
    if (!isSearching) return EMPTY_SEARCH_RESULT;
    const source = matchesFilters ? events.filter(matchesFilters) : events;
    return searchEvents(source, searchQuery, { context: searchContext });
  }, [isSearching, searchQuery, events, matchesFilters, searchContext]);

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
    const master = ev?.masterId ? events.find((e) => e.id === ev.masterId) || ev : ev;
    // A subscribed calendar's series cannot be split -- the feed owns it, and
    // what the family adds on top applies to the whole series anyway.
    if (ev?.masterId && isValidRecurrence(master.recurrence) && !isFeedEvent(master)) {
      setScopeFor({ event: ev, master });
      return;
    }
    setEditing({ mode: 'event', event: master });
  }

  function chooseScope(scope) {
    if (!scopeFor) return;
    setEditing(scope === 'this'
      ? { mode: 'occurrence', event: scopeFor.event, master: scopeFor.master }
      : { mode: 'event', event: scopeFor.master });
    setScopeFor(null);
  }

  function handleCreateAt(date) {
    setSelected(date);
    setEditing({ mode: 'new', date });
  }

  async function handleSubmit(values) {
    if (editing?.mode === 'occurrence') {
      const { event: occ, master } = editing;
      // The form does not edit the place or the end, so the detached event
      // keeps the series' place and its length at the new time.
      const end = eventEnd(occ);
      const endDate = values.endDate !== undefined
        ? values.endDate
        : end && new Date(values.date.getTime() + (end - occ.date));
      await detachOccurrence({
        familyId: userDoc.familyId,
        userId: user.uid,
        master,
        occurrenceDate: occ.date,
        values: { ...values, endDate: endDate || null, location: occ.location },
      });
    } else if (editing?.mode === 'event') {
      const target = editing.event;
      // A subscribed calendar is computed from its feed, so its title, time and
      // description cannot be written back. What the family adds on top is
      // stored as an overlay instead.
      if (isFeedEvent(target)) {
        await saveFeedAnnotation({
          familyId: userDoc.familyId,
          userId: user.uid,
          event: target,
          values,
        });
      } else {
        await updateEvent(target.id, values);
      }
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
    if (editing?.mode === 'occurrence') {
      await excludeOccurrence(editing.master, editing.event.date);
    } else if (editing?.mode === 'event' && !isFeedEvent(editing.event)) {
      // Feed events have no document to delete; the form hides the button.
      await deleteEvent(editing.event.id);
    } else {
      return;
    }
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

  // Switches the selected day between the list of cards and the hour grid. It
  // belongs next to the other calendar-wide actions rather than inside the day
  // itself, and the icon names what a tap gets you, not what is on screen.
  const timelineButton = (
    <button
      onClick={() => setShowDayTimeline(!showDayTimeline)}
      aria-pressed={showDayTimeline}
      aria-label={showDayTimeline ? t('calendar.switchToList') : t('calendar.switchToTimeline')}
      title={showDayTimeline ? t('calendar.switchToList') : t('calendar.switchToTimeline')}
      className={`rounded-full p-2 hover:bg-slate-100 ${
        showDayTimeline ? 'bg-brand-50 text-brand-600' : 'text-slate-600'
      }`}
    >
      {showDayTimeline ? <List size={18} /> : <CalendarClock size={18} />}
    </button>
  );

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

  // The hour grid shows one day; search results span many, so the switch has
  // nothing to act on while a search is open.
  const topBarActions = (
    <>
      {!isSearching && timelineButton}
      {syncButton}
      {exportButton}
    </>
  );

  return (
    <>
      <TopBar title={view === 'week' ? t('calendar.thisWeek') : t('calendar.familyCalendar')} right={topBarActions} />
      <main className="mx-auto max-w-md space-y-5 px-5 py-5">
        <EventSearchBar value={search} onChange={setSearch} />
        <FeedIssueBanner reports={feedReports} />
        {!isSearching && <ViewToggle value={view} onChange={setView} />}
        <FilterChips chips={chips} selected={activeFilters} onToggle={handleToggle} />
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">{t('calendar.loadingEvents')}</p>
        ) : error ? (
          <p className="rounded-xl bg-red-50 px-3 py-4 text-center text-sm text-red-700">
            {t('calendar.loadFailed')}
          </p>
        ) : isSearching ? (
          <SearchResults
            query={searchQuery}
            results={searchResults}
            feedErrors={feedErrors}
            onEventClick={handleEventClick}
          />
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
            onCreateAt={handleCreateAt}
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
            onCreateAt={handleCreateAt}
          />
        )}
      </main>

      <EventFormModal
        open={Boolean(editing)}
        initial={editing && editing.mode !== 'new' ? editing.event : null}
        initialDate={editing?.mode === 'new' ? editing.date : undefined}
        initialTime={editing?.mode === 'new' ? format(editing.date, 'HH:mm') : undefined}
        occurrence={editing?.mode === 'occurrence'}
        onClose={() => setEditing(null)}
        onSubmit={handleSubmit}
        onDelete={editing && editing.mode !== 'new' ? handleDelete : undefined}
      />

      <Modal
        open={Boolean(scopeFor)}
        onClose={() => setScopeFor(null)}
        title={t('calendar.editScopeTitle')}
      >
        {scopeFor && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{scopeFor.event.title}</span>
              {` · ${formatDate(scopeFor.event.date, 'weekdayShort')}`}
            </p>
            <p className="text-sm text-slate-600">{t('calendar.editScopeText')}</p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => chooseScope('this')}>{t('calendar.editOnlyThis')}</Button>
              <Button variant="secondary" onClick={() => chooseScope('all')}>
                {t('calendar.editWholeSeries')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
