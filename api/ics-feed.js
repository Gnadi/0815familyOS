// Read-only ICS subscription feed for a family's calendar.
//
// GET /api/ics-feed?token=<icsFeedToken>
//
// The token is a per-family secret stored on the family document; members
// generate (or reset) it in Settings → Calendar feed. Whoever holds the token
// can read the family's events as an iCalendar file, which is exactly what
// consumer calendar apps (Google/Apple/Outlook "subscribe by URL") need.
//
// Firestore is accessed with the Admin SDK, so this endpoint requires the
// FIREBASE_SERVICE_ACCOUNT env var (the JSON of a service-account key) to be
// configured on the deployment. Without it the endpoint responds 503 and the
// in-app download/export path still works client-side.

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildICS } from '../src/utils/ics.js';
import { expandEventsInRange } from '../src/utils/recurrence.js';

// Feed window: a month of history plus a year ahead. Recurring events are
// expanded into concrete occurrences because consumer calendars refresh the
// feed regularly anyway and expanded VEVENTs render identically everywhere.
const PAST_DAYS = 30;
const FUTURE_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

// Tokens are hex strings generated client-side (48 chars today; accept a
// range so the format can evolve without breaking old feeds).
const TOKEN_RE = /^[a-f0-9]{32,128}$/;

let db = null;
function getDb() {
  if (db) return db;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(raw)) });
  db = getFirestore(app);
  return db;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  let store;
  try {
    store = getDb();
  } catch {
    store = null;
  }
  if (!store) {
    res.status(503).json({ error: 'Calendar feed is not configured on this server.' });
    return;
  }

  const token = String(req.query?.token || '').toLowerCase();
  if (!TOKEN_RE.test(token)) {
    res.status(400).json({ error: 'Invalid feed token.' });
    return;
  }

  try {
    const famSnap = await store
      .collection('families')
      .where('icsFeedToken', '==', token)
      .limit(1)
      .get();
    if (famSnap.empty) {
      res.status(404).json({ error: 'Unknown feed.' });
      return;
    }
    const famDoc = famSnap.docs[0];

    const eventsSnap = await store
      .collection('events')
      .where('familyId', '==', famDoc.id)
      .get();
    const events = eventsSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title,
          description: data.description,
          recurrence: data.recurrence || null,
          date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
        };
      })
      .filter((e) => e.date instanceof Date && !Number.isNaN(e.date.getTime()));

    const now = Date.now();
    const expanded = expandEventsInRange(
      events,
      new Date(now - PAST_DAYS * DAY_MS),
      new Date(now + FUTURE_DAYS * DAY_MS),
    );

    const ics = buildICS(expanded, {
      calendarName: famDoc.data().name || 'myFAOS',
    });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    // Private: the URL embeds a capability token, so shared caches must not
    // store the body. Calendar clients poll on their own schedule anyway.
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.status(200).send(ics);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Feed generation failed.' });
  }
}
