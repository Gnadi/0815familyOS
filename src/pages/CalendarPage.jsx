import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
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

  const filteredEvents = useMemo(() => {
    if (activeFilters.size === 0) return events;
    const memberChips = chips.filter((c) => c.id.startsWith('member:') && activeFilters.has(c.id));
    const kidChips = chips.filter((c) => c.id.startsWith('kid:') && activeFilters.has(c.id));
    return events.filter((ev) => {
      if (memberChips.some((c) => ev.responsibleParent === c.displayName)) return true;
      if (kidChips.some((c) => (ev.kids || []).includes(c.kidId))) return true;
      return false;
    });
  }, [events, activeFilters, chips]);

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

  return (
    <>
      <TopBar title={view === 'week' ? 'This Week' : 'Family Calendar'} />
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
            onEventClick={setEditing}
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
            onEventClick={setEditing}
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
