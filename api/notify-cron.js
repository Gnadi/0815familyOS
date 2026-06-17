import { getAdminDb } from './firebase-admin.js';

// Runs daily at 07:00 UTC (configured in vercel.json).
// For each family, generates notification documents for:
//   - Events starting within the next 24 hours
//   - Tasks that are due today and not yet completed
//   - Vaccinations due within the next 30 days and not yet done
// Idempotent: skips creating a notification if one already exists for the
// same entity on the same scheduled date.

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'] ?? '';
  if (secret && authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getAdminDb();
  const now = new Date();
  const todayStr = toDateStr(now);
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let created = 0;

  // Load all families
  const familiesSnap = await db.collection('families').get();

  await Promise.all(
    familiesSnap.docs.map(async (familyDoc) => {
      const familyId = familyDoc.id;

      // --- Event reminders ---
      const eventsSnap = await db
        .collection('events')
        .where('familyId', '==', familyId)
        .get();

      for (const d of eventsSnap.docs) {
        const event = d.data();
        const eventDate = event.date?.toDate ? event.date.toDate() : null;
        if (!eventDate) continue;
        if (eventDate >= now && eventDate <= in24h) {
          const written = await maybeCreateNotification(db, {
            familyId,
            type: 'event_reminder',
            entityId: d.id,
            scheduledFor: todayStr,
            title: `Upcoming: ${event.title}`,
            body: formatEventTime(eventDate),
            link: '/calendar',
          });
          if (written) created++;
        }
      }

      // --- Task due reminders ---
      const tasksSnap = await db
        .collection('tasks')
        .where('familyId', '==', familyId)
        .where('status', '!=', 'completed')
        .get();

      for (const d of tasksSnap.docs) {
        const task = d.data();
        const due = task.dueDate?.toDate ? task.dueDate.toDate() : null;
        if (!due) continue;
        if (toDateStr(due) <= todayStr) {
          const written = await maybeCreateNotification(db, {
            familyId,
            type: 'task_due',
            entityId: d.id,
            scheduledFor: todayStr,
            title: `Task due: ${task.title}`,
            body: toDateStr(due) < todayStr ? 'This task is overdue' : 'Due today',
            link: '/tasks',
          });
          if (written) created++;
        }
      }

      // --- Vaccination reminders ---
      const vacsSnap = await db
        .collection('vaccinations')
        .where('familyId', '==', familyId)
        .get();

      for (const d of vacsSnap.docs) {
        const vac = d.data();
        if (vac.status === 'done') continue;
        // nextDueDate is stored as an ISO string YYYY-MM-DD
        const nextDue = vac.nextDueDate ? new Date(vac.nextDueDate) : null;
        if (!nextDue) continue;
        if (nextDue <= in30d) {
          const written = await maybeCreateNotification(db, {
            familyId,
            type: 'vaccination_due',
            entityId: d.id,
            scheduledFor: todayStr,
            title: `Vaccination due: ${vac.name}`,
            body: `Due ${vac.nextDueDate}`,
            link: '/health',
          });
          if (written) created++;
        }
      }
    })
  );

  return res.status(200).json({ notificationsCreated: created });
}

// Creates a notification only if one doesn't already exist for this
// entity + scheduledFor date (idempotency guard).
async function maybeCreateNotification(db, payload) {
  const existing = await db
    .collection('notifications')
    .where('entityId', '==', payload.entityId)
    .where('scheduledFor', '==', payload.scheduledFor)
    .limit(1)
    .get();

  if (!existing.empty) return false;

  await db.collection('notifications').add({
    ...payload,
    read: false,
    createdAt: new Date(),
  });
  return true;
}

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

function formatEventTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
