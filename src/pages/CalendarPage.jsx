import { useState } from 'react';
import TopBar from '../components/layout/TopBar';
import ViewToggle from '../components/calendar/ViewToggle';
import WeekView from '../components/calendar/WeekView';
import MonthView from '../components/calendar/MonthView';
import EventFormModal from '../components/calendar/EventFormModal';
import useAuth from '../hooks/useAuth';
import useEvents from '../hooks/useEvents';
import { createEvent, deleteEvent, updateEvent } from '../services/events';

export default function CalendarPage() {
  const { user, userDoc } = useAuth();
  const { events, loading } = useEvents(userDoc?.familyId);
  const [view, setView] = useState('week');
  const [anchor, setAnchor] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [editing, setEditing] = useState(null); // event object or 'new' or null

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
            events={events}
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
            events={events}
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
