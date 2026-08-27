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
import { loadAllFeeds } from './calendarFeeds';
import { isDemoMode } from '../lib/demoMode';
import { demoAdd, demoDelete, demoDocs, demoSubscribe, demoUpdate } from './demoStore';

const eventsRef = collection(db, 'events');

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
  return { freq, interval, until };
}

function mapEventDoc(d) {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    category: normalizeCategory(data.category),
    date: data.date?.toDate ? data.date.toDate() : data.date,
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

export function createEvent({ familyId, userId, title, description, date, category, kids, responsibleParent, effortLevel, recurrence }) {
  const payload = {
    familyId,
    userId,
    title: title.trim(),
    description: description?.trim() || '',
    category: normalizeCategory(category),
    date: dateVal(date),
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

export function updateEvent(id, { title, description, date, category, kids, responsibleParent, effortLevel, recurrence }) {
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
