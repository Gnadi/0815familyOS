import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DEFAULT_CATEGORY } from '../constants/eventCategories';
import {
  annotationDocId,
  applyAnnotations,
  hasAnnotation,
  indexAnnotations,
} from '../utils/calendarSync';
import { DAY_CODES } from '../utils/recurrence';
import { loadAllFeeds } from './calendarFeeds';
import { isDemoMode } from '../lib/demoMode';
import { demoAdd, demoDelete, demoDocs, demoSubscribe, demoUpdate } from './demoStore';

const eventsRef = collection(db, 'events');

// Firestore caps a write batch at 500 operations.
const BATCH_LIMIT = 450;

// In demo mode payloads carry plain JS Dates (the demo store never sees
// Firestore sentinels); otherwise the usual Timestamp/serverTimestamp values.
const nowVal = () => (isDemoMode() ? new Date() : serverTimestamp());
const dateVal = (d) => (isDemoMode() ? d : Timestamp.fromDate(d));

function normalizeCategory(category) {
  return typeof category === 'string' && category.trim() ? category : DEFAULT_CATEGORY;
}

function normalizeRecurrence(rec) {
  if (!rec || !rec.freq) return null;
  const freq = ['daily', 'weekly', 'monthly', 'yearly'].includes(rec.freq) ? rec.freq : null;
  if (!freq) return null;
  const interval = Math.max(1, Math.min(99, Math.round(Number(rec.interval) || 1)));
  const until = rec.until ? String(rec.until) : null;

  // BYDAY, COUNT and the cancelled occurrences of an imported series. The event
  // form cannot express them, so they only ever arrive from an .ics import --
  // and this function runs on every read as well as every write, so dropping
  // them here would quietly turn a "Mon, Wed, Fri" import back into a
  // Mondays-only series the first time anyone opened the calendar.
  const byDay = Array.isArray(rec.byDay)
    ? rec.byDay.filter((d) => DAY_CODES.includes(d))
    : null;
  const count = Number.isFinite(Number(rec.count)) && Number(rec.count) > 0
    ? Math.floor(Number(rec.count))
    : null;
  const exdates = Array.isArray(rec.exdates)
    ? rec.exdates.filter((d) => typeof d === 'string' && d)
    : null;

  return {
    freq,
    interval,
    until,
    byDay: byDay?.length ? byDay : null,
    count,
    exdates: exdates?.length ? exdates : null,
  };
}

// Firestore hands dates back as Timestamps; everything downstream works with
// JS Dates.
function toJsDate(value) {
  if (!value) return null;
  return value.toDate ? value.toDate() : value;
}

function mapEventDoc(d) {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    category: normalizeCategory(data.category),
    date: toJsDate(data.date),
    // Imported events carry the DTEND of their VEVENT. The event form has no
    // end field, so an event created here simply has none.
    endDate: toJsDate(data.endDate),
    kids: data.kids || [],
    responsibleParent: data.responsibleParent || '',
    effortLevel: data.effortLevel || '',
    recurrence: normalizeRecurrence(data.recurrence),
  };
}

function mapEventDocs(docs) {
  return docs
    .map(mapEventDoc)
    .sort((a, b) => (a.date?.getTime?.() || 0) - (b.date?.getTime?.() || 0));
}

// `onError` is optional but important: without it a failing listener (offline,
// a rules rejection, a missing index) simply never calls back, and every screen
// waiting on the first snapshot stays on its loading state forever.
export function subscribeEvents(familyId, cb, onError) {
  if (isDemoMode()) return demoSubscribe('events', (docs) => cb(mapEventDocs(docs)));
  const q = query(eventsRef, where('familyId', '==', familyId), orderBy('date', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map(mapEventDoc));
    },
    (err) => {
      console.error('Events listener failed:', err);
      onError?.(err);
    },
  );
}

// The whole family calendar in one shot: stored events plus the subscribed
// calendars computed from their feeds, annotations applied. Used by the .ics
// export, which has to reproduce exactly what the app shows.
export async function fetchCalendarOnce(familyId, subscriptions) {
  const all = isDemoMode()
    ? mapEventDocs(demoDocs('events'))
    : (await getDocs(
        query(eventsRef, where('familyId', '==', familyId), orderBy('date', 'asc')),
      )).docs.map(mapEventDoc);

  const own = all.filter((ev) => ev.source !== 'annotation');
  if (!subscriptions?.length) return own;

  const { events } = await loadAllFeeds(subscriptions);
  return [...own, ...applyAnnotations(events, indexAnnotations(all))];
}

export function createEvent({ familyId, userId, title, description, date, endDate, category, kids, responsibleParent, effortLevel, recurrence }) {
  const payload = {
    familyId,
    userId,
    title: title.trim(),
    description: description?.trim() || '',
    category: normalizeCategory(category),
    date: dateVal(date),
    endDate: endDate ? dateVal(endDate) : null,
    kids: kids || [],
    responsibleParent: responsibleParent || '',
    effortLevel: effortLevel || '',
    recurrence: normalizeRecurrence(recurrence),
    createdAt: nowVal(),
    updatedAt: nowVal(),
  };
  if (isDemoMode()) return demoAdd('events', payload);
  return addDoc(eventsRef, payload);
}

export function updateEvent(id, { title, description, date, endDate, category, kids, responsibleParent, effortLevel, recurrence }) {
  const payload = {
    title: title.trim(),
    description: description?.trim() || '',
    category: normalizeCategory(category),
    date: dateVal(date),
    kids: kids || [],
    responsibleParent: responsibleParent || '',
    effortLevel: effortLevel || '',
    recurrence: normalizeRecurrence(recurrence),
    updatedAt: nowVal(),
  };
  // The event form cannot express an end time yet, so it sends none. Writing a
  // null for it anyway would erase the DTEND of an imported event the first
  // time anyone touched its category.
  if (endDate !== undefined) payload.endDate = endDate ? dateVal(endDate) : null;
  if (isDemoMode()) return demoUpdate('events', id, payload);
  return updateDoc(doc(db, 'events', id), payload);
}

// Save the family's annotations for one feed event.
//
// A subscribed calendar is computed from its .ics feed and never stored, so the
// feed owns the title, time and description. What the family adds on top --
// who is responsible, which kids are involved, the effort, the category -- has
// nowhere else to live, so it goes into a small overlay document keyed to the
// feed event. Only annotated events get one; the rest cost nothing.
export function saveFeedAnnotation({ familyId, userId, event, values }) {
  const id = annotationDocId(event.subscriptionId, event.externalId);
  // Nothing worth keeping any more: drop the overlay rather than storing an
  // empty one.
  if (!hasAnnotation(values)) return clearFeedAnnotation(id);

  const payload = {
    familyId,
    userId,
    source: 'annotation',
    subscriptionId: event.subscriptionId,
    externalId: event.externalId,
    // Denormalised so the document satisfies the events listener's date
    // ordering; it is never rendered as an event of its own.
    date: dateVal(event.date),
    category: normalizeCategory(values.category),
    kids: values.kids || [],
    responsibleParent: values.responsibleParent || '',
    effortLevel: values.effortLevel || '',
    updatedAt: nowVal(),
  };
  if (isDemoMode()) return demoUpdate('events', id, payload);
  return setDoc(doc(db, 'events', id), payload, { merge: true });
}

export function clearFeedAnnotation(id) {
  if (isDemoMode()) return demoDelete('events', id);
  return deleteDoc(doc(db, 'events', id));
}

export function deleteEvent(id) {
  if (isDemoMode()) return demoDelete('events', id);
  return deleteDoc(doc(db, 'events', id));
}

// Reassign every event in `familyId` whose category equals `fromCategoryId`
// to `toCategoryId`. Filtered client-side so we only need the single-field
// `familyId` index (Firestore builds that automatically).
export async function reassignEventsCategory(
  familyId,
  fromCategoryId,
  toCategoryId = DEFAULT_CATEGORY
) {
  if (isDemoMode()) {
    const targets = demoDocs('events').filter((d) => d.data().category === fromCategoryId);
    for (const d of targets) {
      await demoUpdate('events', d.id, { category: toCategoryId, updatedAt: new Date() });
    }
    return targets.length;
  }
  const q = query(eventsRef, where('familyId', '==', familyId));
  const snap = await getDocs(q);
  const targets = snap.docs.filter((d) => d.data().category === fromCategoryId);
  if (targets.length === 0) return 0;
  const batch = writeBatch(db);
  targets.forEach((d) =>
    batch.update(d.ref, { category: toCategoryId, updatedAt: serverTimestamp() })
  );
  await batch.commit();
  return targets.length;
}

// Carry a member rename across their existing events.
//
// An event points at the responsible parent by display name, not by uid (see
// EventFormModal), so without this a rename silently drops every existing
// assignment out of the calendar's member filter and the workload balance.
// Feed annotations live in this same collection and hold the same field, so
// the single familyId query covers them too.
//
// Writes are chunked because Firestore caps a batch at 500 operations, and a
// family that has been using the calendar for a while can easily pass that.
export async function renameResponsibleParent(familyId, fromName, toName) {
  const from = (fromName || '').trim();
  const to = (toName || '').trim();
  if (!familyId || !from || !to || from === to) return 0;

  if (isDemoMode()) {
    const targets = demoDocs('events').filter((d) => d.data().responsibleParent === from);
    for (const d of targets) {
      await demoUpdate('events', d.id, { responsibleParent: to, updatedAt: new Date() });
    }
    return targets.length;
  }

  const snap = await getDocs(query(eventsRef, where('familyId', '==', familyId)));
  const targets = snap.docs.filter((d) => d.data().responsibleParent === from);
  for (let i = 0; i < targets.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    targets.slice(i, i + BATCH_LIMIT).forEach((d) =>
      batch.update(d.ref, { responsibleParent: to, updatedAt: serverTimestamp() }),
    );
    await batch.commit();
  }
  return targets.length;
}
