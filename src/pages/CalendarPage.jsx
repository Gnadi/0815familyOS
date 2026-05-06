import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Download } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import ViewToggle from '../components/calendar/ViewToggle';
import FilterChips from '../components/calendar/FilterChips';
import WeekView from '../components/calendar/WeekView';
import MonthView from '../components/calendar/MonthView';
import EventFormModal from '../components/calendar/EventFormModal';
import useAuth from '../hooks/useAuth';
import useEvents from '../hooks/useEvents';
import useFamilyMembers from '../hooks/useFamilyMembers';
import { createEvent, deleteEvent, updateEvent } from '../services/events';
import { downloadICS } from '../utils/ics';
import { expandEventsInRange } from '../utils/recurrence';

const MEMBER_PALETTE = ['red', 'blue', 'emerald', 'amber', 'violet', 'pink', 'cyan'];

export default function CalendarPage() {
  const { user, userDoc, family } = useAuth();
  const { events, loading } = useEvents(userDoc?.familyId);
  const members = useFamilyMembers();
  const { setCreateDefaultDate } = useOutletContext() || {};
  const [view, setView] = useState('week');
  const [anchor, setAnchor] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [editing, setEditing] = useState(null); // event object or 'new' or null
  const [activeFilters, setActiveFilters] = useState(new Set());

  const chips = useMemo(() => [
    { id: 'all', label: 'All', colorKey: 'slate' },
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
  ], [members, family?.kids]);

  const expandedEvents = useMemo(() => {
    const from = new Date(anchor.getFullYear(), anchor.getMonth() - 6, 1);
    const to = new Date(anchor.getFullYear(), anchor.getMonth() + 6, 31, 23, 59, 59);
    return expandEventsInRange(events, from, to);
  }, [events, anchor]);

  const filteredEvents = useMemo(() => {
    if (activeFilters.size === 0) return expandedEvents;
    const memberChips = chips.filter((c) => c.id.startsWith('member:') && activeFilters.has(c.id));
    const kidChips = chips.filter((c) => c.id.startsWith('kid:') && activeFilters.has(c.id));
    return expandedEvents.filter((ev) => {
      if (memberChips.some((c) => ev.responsibleParent === c.displayName)) return true;
      if (kidChips.some((c) => (ev.kids || []).includes(c.kidId))) return true;
      return false;
    });
  }, [expandedEvents, activeFilters, chips]);

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
    if (!editing || editing === 'new') return;
    await deleteEvent(editing.id);
    setEditing(null);
  }

  function handleExport() {
    if (!filteredEvents.length) return;
    const today = new Date();
    const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
    const future = filteredEvents.filter((ev) => ev.date && ev.date >= horizon);
    downloadICS(future, `family-calendar-${today.toISOString().slice(0, 10)}.ics`, {
      calendarName: family?.name ? `${family.name} (FamilyOS)` : 'FamilyOS',
    });
  }

  const exportButton = (
    <button
      onClick={handleExport}
      aria-label="Export calendar"
      title="Export to .ics"
      className="rounded-full p-2 text-slate-600 hover:bg-slate-100"
    >
      <Download size={18} />
    </button>
  );

  return (
    <>
      <TopBar title={view === 'week' ? 'This Week' : 'Family Calendar'} right={exportButton} />
      <main className="mx-auto max-w-md space-y-5 px-5 py-5">
        <ViewToggle value={view} onChange={setView} />
        <FilterChips chips={chips} selected={activeFilters} onToggle={handleToggle} />
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">Loading events…</p>
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
