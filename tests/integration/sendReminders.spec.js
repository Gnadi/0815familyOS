// The push sender (functions/sendReminders.js) against the Firestore emulator.
// Run with `npm run test:integration`, which copies the shared rules into
// functions/shared and starts the emulator around it.
//
// Pushes are encrypted exactly as web-push sends them and decrypted the way
// the browser would, so what is asserted is what a phone would display.

import crypto from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import webpush from 'web-push';
import ece from 'http_ece';
import { sendDueReminders } from '../../functions/sendReminders.js';

const NOW = new Date('2026-09-26T12:25:00Z'); // 14:25 in Vienna, 08:25 in New York
const ts = (iso) => Timestamp.fromDate(new Date(iso));
const vapid = webpush.generateVAPIDKeys();
const quiet = () => {};

function device(name) {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return {
    name,
    ecdh,
    auth,
    sub: {
      endpoint: `https://push.example/${name}`,
      keys: { p256dh: ecdh.getPublicKey('base64url'), auth: auth.toString('base64url') },
    },
  };
}

const VIENNA = device('alexVienna');
const SECOND = device('alexSecond');
const GONE = device('alexGone');
const NEW_YORK = device('samNewYork');
const EX_MEMBER = device('exMember');
const DEVICES = [VIENNA, SECOND, GONE, NEW_YORK, EX_MEMBER];

let app;
let db;
let received;

async function sendPush(subscription, payload, ttl) {
  const d = DEVICES.find((x) => x.sub.endpoint === subscription.endpoint);
  if (d === GONE) throw Object.assign(new Error('gone'), { statusCode: 410 });
  const req = webpush.generateRequestDetails(subscription, payload, {
    TTL: ttl,
    vapidDetails: { subject: 'mailto:test@example.com', publicKey: vapid.publicKey, privateKey: vapid.privateKey },
  });
  const plain = ece.decrypt(req.body, {
    version: 'aes128gcm',
    privateKey: d.ecdh,
    authSecret: d.auth.toString('base64url'),
  });
  received.push({ device: d.name, ttl: Number(req.headers.TTL), ...JSON.parse(plain.toString()) });
}

const to = (d) => received.filter((r) => r.device === d.name);

beforeAll(() => {
  app = initializeApp({ projectId: 'faos-rules-test' }, 'send-reminders-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  received = [];
  await Promise.all((await db.listCollections()).map((c) => db.recursiveDelete(c)));

  const add = (path, data) => db.doc(path).set(data);
  const sub = (uid, d, extra) => add(`users/${uid}/pushSubscriptions/${d.name}`, { ...d.sub, ...extra });

  await add('families/fam1', { memberIds: ['u1', 'u2'], kids: [{ id: 'k1', name: 'Anna' }] });
  await add('users/u1', { familyId: 'fam1', displayName: 'Alex' });
  await add('users/u2', { familyId: 'fam1', displayName: 'Sam' });
  // Left the family but still carries its id.
  await add('users/u3', { familyId: 'fam1', displayName: 'Ex' });

  await sub('u1', VIENNA, { timeZone: 'Europe/Vienna', locale: 'de' });
  await sub('u1', SECOND, {
    timeZone: 'Europe/Vienna',
    locale: 'de',
    sent: { 'task:t1:2026-9-26': NOW.getTime() + 3600e3, 'expired:x': 1 },
  });
  await sub('u1', GONE, { timeZone: 'Europe/Vienna', locale: 'de' });
  await sub('u2', NEW_YORK, { timeZone: 'America/New_York', locale: 'en' });
  await sub('u3', EX_MEMBER, { timeZone: 'Europe/Vienna', locale: 'de' });

  await add('events/e1', { familyId: 'fam1', title: 'Zahnarzt', date: ts('2026-09-26T12:50:00Z'), responsibleParent: 'Alex', location: 'Praxis' });
  await add('events/old', { familyId: 'fam1', title: 'Old', date: ts('2026-01-01T10:00:00Z') });
  await add('events/swim', { familyId: 'fam1', title: 'Swimming', date: ts('2026-06-06T12:40:00Z'), responsibleParent: '', recurrence: { freq: 'weekly', interval: 1, until: null } });
  await add('events/overlay', { familyId: 'fam1', title: 'overlay', source: 'annotation', date: ts('2026-09-26T12:45:00Z') });
  await add('tasks/t1', { familyId: 'fam1', title: 'Kita-Beitrag', status: 'planned', dueDate: ts('2026-09-26T07:00:00Z'), assigneeIds: [] });
  await add('trackers/tr1', { familyId: 'fam1', name: 'Ibuprofen', emoji: '💊', kidIds: ['k1'], minIntervalHours: 6 });
  await add('trackerEntries/en1', { familyId: 'fam1', trackerId: 'tr1', kidId: 'k1', at: ts('2026-09-26T06:00:00Z') });
});

describe('sendDueReminders', () => {
  it('writes each reminder in the device’s own time zone and language', async () => {
    await sendDueReminders({ db, sendPush, now: NOW, log: quiet });
    expect(to(SECOND).find((r) => r.title === 'Swimming').body).toBe('Beginnt um 14:40');
    expect(to(NEW_YORK).find((r) => r.title === 'Swimming').body).toBe('Starts at 08:40');
    expect(to(NEW_YORK).find((r) => r.tag.startsWith('tracker-dose')).body).toBe(
      'The next dose for Anna is possible now.',
    );
  });

  it('only sends a member what concerns them', async () => {
    const stats = await sendDueReminders({ db, sendPush, now: NOW, log: quiet });
    // Alex's appointment is not Sam's; the former member gets nothing.
    expect(to(NEW_YORK).map((r) => r.title)).not.toContain('Zahnarzt');
    expect(to(EX_MEMBER)).toHaveLength(0);
    expect(stats.devices).toBe(4);
    // Annotation overlays and events far outside the window never show up.
    expect(received.map((r) => r.title)).not.toContain('overlay');
    expect(received.map((r) => r.title)).not.toContain('Old');
  });

  it('skips what a device already showed and folds a burst into a summary', async () => {
    await sendDueReminders({ db, sendPush, now: NOW, log: quiet });
    expect(to(SECOND).map((r) => r.tag)).not.toContain('task:t1:2026-9-26');
    expect(to(SECOND)).toHaveLength(3);
    expect(to(VIENNA)).toEqual([expect.objectContaining({ tag: 'summary', title: '4 Erinnerungen' })]);
  });

  it('gives each push a TTL that ends when the reminder stops mattering', async () => {
    await sendDueReminders({ db, sendPush, now: NOW, log: quiet });
    // The dentist starts at 12:50Z, 25 minutes after NOW.
    expect(to(SECOND).find((r) => r.title === 'Zahnarzt').ttl).toBe(25 * 60);
  });

  it('records what it sent, drops expired entries, and never sends twice', async () => {
    await sendDueReminders({ db, sendPush, now: NOW, log: quiet });
    const sent = (await db.doc('users/u1/pushSubscriptions/alexSecond').get()).data().sent;
    expect(Object.keys(sent)).not.toContain('expired:x');
    expect(Object.keys(sent)).toHaveLength(4);

    received = [];
    const again = await sendDueReminders({ db, sendPush, now: NOW, log: quiet });
    expect(again.sent).toBe(0);
    expect(received).toHaveLength(0);
  });

  it('removes a subscription the push service reports as gone', async () => {
    const stats = await sendDueReminders({ db, sendPush, now: NOW, log: quiet });
    expect(stats.removed).toBe(1);
    expect((await db.doc('users/u1/pushSubscriptions/alexGone').get()).exists).toBe(false);
  });

  it('sends and writes nothing on a dry run', async () => {
    await sendDueReminders({ db, sendPush, now: NOW, dryRun: true, log: quiet });
    expect(received).toHaveLength(0);
    expect((await db.doc('users/u1/pushSubscriptions/alexGone').get()).exists).toBe(true);
  });
});
