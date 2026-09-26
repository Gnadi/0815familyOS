// Sends due reminders as Web Push notifications to devices where myFAOS is
// closed. Run every ten minutes by .github/workflows/reminders.yml.
//
// It applies exactly the rules the app uses while open (src/utils/
// reminders.js), per member and per device:
//
//   1. every stored push subscription (users/{uid}/pushSubscriptions/*),
//   2. the member's document (family, name, reminder preferences),
//   3. the family's data, read in narrow windows around now and once per
//      family however many members and devices it has,
//   4. reminders computed in the device's own time zone ("08:00" is local)
//      and written in its language, minus what the device already showed.
//
// Environment:
//   FIREBASE_SERVICE_ACCOUNT  service-account JSON with Firestore access
//   FIREBASE_PROJECT_ID       optional; defaults to the service account's
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: or https: URL)
//
// `--dry-run` computes and logs everything but sends and writes nothing.
// With FIRESTORE_EMULATOR_HOST set, it runs against the emulator and needs no
// service account.

import { pathToFileURL } from 'node:url';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import webpush from 'web-push';
import en from '../src/i18n/locales/en.js';
import de from '../src/i18n/locales/de.js';
import { FREQS } from '../src/utils/recurrence.js';
import { collectReminders, dueReminders, notificationBatch } from '../src/utils/reminders.js';

const HOUR_MS = 60 * 60 * 1000;
// Queries reach this far either side of now. Wide enough for any time zone's
// "today" (UTC-12 to UTC+14) plus the reminders' own 24-hour horizon.
const WINDOW_MS = 40 * HOUR_MS;
// How long after its cooldown a dose reminder is still sent (TRACKER_GRACE_MS
// in reminders.js), so entries older than the longest interval plus this can
// never produce one.
const TRACKER_GRACE_MS = 2 * HOUR_MS;
const DEFAULT_TIME_ZONE = 'Europe/Berlin';
const DICTS = { en, de };

// ---------------------------------------------------------------- i18n

function lookup(dict, key) {
  return key.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), dict);
}

function translator(locale) {
  const dict = DICTS[locale] || DICTS.en;
  return (key, vars) => {
    const template = lookup(dict, key) ?? lookup(DICTS.en, key) ?? key;
    if (!vars || typeof template !== 'string') return template;
    return template.replace(/\{(\w+)\}/g, (m, name) => (vars[name] != null ? String(vars[name]) : m));
  };
}

function validTimeZone(tz) {
  if (!tz) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

// ---------------------------------------------------------------- data

// Firestore Timestamps to Dates, recursively, the way the app's services
// hand data to reminders.js.
function plain(value) {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) }));

// Everything reminders.js looks at for one family, and nothing more: a
// family's full history would cost a read per document, every ten minutes.
async function loadFamilyData(db, familyId, now) {
  const from = Timestamp.fromMillis(now.getTime() - WINDOW_MS);
  const to = Timestamp.fromMillis(now.getTime() + WINDOW_MS);
  const byFamily = (name) => db.collection(name).where('familyId', '==', familyId);

  const [familySnap, oneOff, recurring, tasks, vaccinations, trackers] = await Promise.all([
    db.collection('families').doc(familyId).get(),
    byFamily('events').where('date', '>=', from).where('date', '<=', to).get(),
    byFamily('events').where('recurrence.freq', 'in', FREQS).get(),
    byFamily('tasks').where('dueDate', '>=', from).where('dueDate', '<=', to).get(),
    byFamily('vaccinations').where('date', '>=', from).where('date', '<=', to).get(),
    byFamily('trackers').get(),
  ]);

  const trackerList = docs(trackers).map((t) => ({
    ...t,
    kidIds: Array.isArray(t.kidIds) ? t.kidIds : t.kidId ? [t.kidId] : [],
  }));
  const longestGapMs = Math.max(0, ...trackerList.map((t) => Number(t.minIntervalHours) || 0)) * HOUR_MS;
  const entriesFrom = Timestamp.fromMillis(now.getTime() - Math.max(WINDOW_MS, longestGapMs + TRACKER_GRACE_MS));
  const trackerEntries = trackerList.length
    ? docs(await byFamily('trackerEntries').where('at', '>=', entriesFrom).get())
    : [];

  // A recurring event whose master falls inside the window comes back from
  // both queries.
  const events = new Map();
  for (const ev of [...docs(oneOff), ...docs(recurring)]) {
    if (ev.source === 'annotation') continue;
    events.set(ev.id, { ...ev, responsibleParent: ev.responsibleParent || '' });
  }

  const family = familySnap.exists ? plain(familySnap.data()) : null;
  return {
    memberIds: family?.memberIds || [],
    kids: family?.kids || [],
    events: [...events.values()],
    tasks: docs(tasks).map((t) => ({ ...t, assigneeIds: Array.isArray(t.assigneeIds) ? t.assigneeIds : [] })),
    vaccinations: docs(vaccinations),
    trackers: trackerList,
    trackerEntries,
  };
}

// ---------------------------------------------------------------- run

// Runs the rules in `timeZone`. Node re-reads process.env.TZ on assignment,
// and reminders.js works in local time (setHours(8) is 08:00 there).
function inTimeZone(timeZone, fn) {
  const previous = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

// One pass. `sendPush(subscription, payload, ttlSeconds)` delivers a message
// and resolves, or rejects with the push service's `statusCode`.
export async function sendDueReminders({ db, sendPush, now = new Date(), dryRun = false, log = console.log }) {
  const stats = { devices: 0, sent: 0, removed: 0, failed: 0 };
  const subsSnap = await db.collectionGroup('pushSubscriptions').get();

  const byUser = new Map();
  for (const snap of subsSnap.docs) {
    const uid = snap.ref.parent.parent?.id;
    const data = snap.data();
    if (!uid || typeof data.endpoint !== 'string' || !data.keys) continue;
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid).push({ ref: snap.ref, data });
  }

  const families = new Map();
  for (const [uid, subscriptions] of byUser) {
    const userSnap = await db.collection('users').doc(uid).get();
    const user = userSnap.data();
    const familyId = user?.familyId;
    if (!familyId) continue;

    if (!families.has(familyId)) families.set(familyId, loadFamilyData(db, familyId, now));
    const data = await families.get(familyId);
    // Someone who left the family keeps a stale familyId until they join
    // another; they must not be reminded of their old family's life.
    if (!data.memberIds.includes(uid)) continue;

    for (const sub of subscriptions) {
      stats.devices += 1;
      const timeZone = validTimeZone(sub.data.timeZone);
      const locale = DICTS[sub.data.locale] ? sub.data.locale : 'en';
      const alreadySent = sub.data.sent || {};
      const sentIds = new Set(Object.entries(alreadySent).filter(([, exp]) => exp > now.getTime()).map(([id]) => id));

      const due = inTimeZone(timeZone, () =>
        dueReminders(
          collectReminders({
            ...data,
            me: { uid, displayName: user.displayName },
            prefs: user.notificationPrefs,
            now,
          }),
          sentIds,
          now,
        ),
      );
      if (due.length === 0) continue;

      const clock = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone });
      const batch = notificationBatch(due, translator(locale), (d) => clock.format(d));
      // The logs of a public repository's workflow runs are public: never
      // name a member, a device or anything about their day in them.
      log(`device ${stats.devices}: ${due.length} due, ${batch.length} to send`);
      if (dryRun) continue;

      let gone = false;
      for (const n of batch) {
        const ttl = Math.max(60, Math.round((n.expiresAt.getTime() - now.getTime()) / 1000));
        try {
          await sendPush(
            { endpoint: sub.data.endpoint, keys: sub.data.keys },
            JSON.stringify({ title: n.title, body: n.body, tag: n.tag, url: n.url }),
            ttl,
          );
          stats.sent += 1;
        } catch (err) {
          // 404/410: the browser dropped the subscription (app uninstalled,
          // permission withdrawn). It will never work again.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            gone = true;
            break;
          }
          stats.failed += 1;
          log(`device ${stats.devices}: push failed (${err?.statusCode ?? 'no status'})`);
        }
      }

      if (gone) {
        await sub.ref.delete();
        stats.removed += 1;
        continue;
      }
      // The whole record is rewritten, which also drops expired entries. A
      // reminder the app showed in the meantime could be lost from it; the
      // worst case is that notification being replaced (same tag) once.
      const sent = Object.fromEntries(Object.entries(alreadySent).filter(([, exp]) => exp > now.getTime()));
      for (const r of due) sent[r.id] = r.expiresAt.getTime();
      await sub.ref.update({ sent });
    }
  }
  return stats;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const { FIREBASE_SERVICE_ACCOUNT, FIREBASE_PROJECT_ID, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

  if (!emulator && !FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set.');
  if (!dryRun && !(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT)) {
    throw new Error('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT must be set.');
  }

  const account = FIREBASE_SERVICE_ACCOUNT ? JSON.parse(FIREBASE_SERVICE_ACCOUNT) : null;
  initializeApp({
    ...(account ? { credential: cert(account) } : {}),
    projectId: FIREBASE_PROJECT_ID || account?.project_id || 'demo-faos',
  });
  const db = getFirestore();

  if (!dryRun) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const sendPush = (subscription, payload, ttl) =>
    webpush.sendNotification(subscription, payload, { TTL: ttl, urgency: 'high' });

  const stats = await sendDueReminders({ db, sendPush, dryRun });
  console.log(
    `${dryRun ? '[dry run] ' : ''}${stats.devices} device(s) checked, ${stats.sent} sent, ` +
      `${stats.removed} expired subscription(s) removed, ${stats.failed} failed.`,
  );
  if (stats.failed > 0 && stats.sent === 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
