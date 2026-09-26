// myFAOS Cloud Functions.
//
// sendReminders: every five minutes, pushes due reminders to devices where
// the app is closed (see ./sendReminders.js). While the app is open it
// reminds on its own, to the minute; the two share each device's `sent`
// record, so nothing is shown twice.
//
// Configuration, asked for by `firebase deploy` the first time:
//   VAPID_PUBLIC_KEY   the public key (also VITE_VAPID_PUBLIC_KEY in the app)
//   VAPID_SUBJECT      a contact for push services, e.g. mailto:you@example.com
//   VAPID_PRIVATE_KEY  secret: firebase functions:secrets:set VAPID_PRIVATE_KEY

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import webpush from 'web-push';
import { sendDueReminders } from './sendReminders.js';

initializeApp();

const vapidPublicKey = defineString('VAPID_PUBLIC_KEY');
const vapidSubject = defineString('VAPID_SUBJECT');
const vapidPrivateKey = defineSecret('VAPID_PRIVATE_KEY');

export const sendReminders = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'Etc/UTC',
    // Frankfurt: next to the families, and to a Firestore database in the EU.
    region: 'europe-west3',
    secrets: [vapidPrivateKey],
    // One run at a time, so a slow run never overlaps the next and sends the
    // same reminder twice. A failed run is not retried: the next one, five
    // minutes later, picks up whatever is still due.
    maxInstances: 1,
    retryCount: 0,
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async () => {
    webpush.setVapidDetails(vapidSubject.value(), vapidPublicKey.value(), vapidPrivateKey.value());
    const stats = await sendDueReminders({
      db: getFirestore(),
      sendPush: (subscription, payload, ttl) =>
        webpush.sendNotification(subscription, payload, { TTL: ttl, urgency: 'high' }),
      log: (message) => logger.info(message),
    });
    logger.info('Reminder run finished', stats);
  },
);
