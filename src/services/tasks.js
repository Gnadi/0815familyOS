import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DEFAULT_TASK_CATEGORY } from '../constants/taskCategories';
import { nextOccurrenceAfter } from '../utils/recurrence';

const tasksRef = collection(db, 'tasks');

function normalizeCategory(category) {
  return typeof category === 'string' && category.trim() ? category : DEFAULT_TASK_CATEGORY;
}

function normalizeStatus(status) {
  return ['backlog', 'planned', 'inProgress', 'completed'].includes(status) ? status : 'backlog';
}

function normalizePriority(priority) {
  return ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal';
}

function clampProgress(progress, status) {
  const n = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
  if (status === 'completed') return 100;
  if (status === 'backlog' || status === 'planned') return 0;
  return n;
}

function toDate(value) {
  if (!value) return null;
  return value?.toDate ? value.toDate() : value;
}

function normalizeRecurrence(rec) {
  if (!rec || !rec.freq) return null;
  const freq = ['daily', 'weekly', 'monthly', 'yearly'].includes(rec.freq) ? rec.freq : null;
  if (!freq) return null;
  const interval = Math.max(1, Math.min(99, Math.round(Number(rec.interval) || 1)));
  const until = rec.until ? String(rec.until) : null;
  return { freq, interval, until };
}

export function subscribeTasks(familyId, cb) {
  // Single-field `familyId` query only — Firestore auto-indexes this so we
  // don't need a composite index. Sort client-side; a family's task list is
  // small enough that this is cheaper than maintaining an index.
  const q = query(tasksRef, where('familyId', '==', familyId));
  return onSnapshot(q, (snap) => {
    const list = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          category: normalizeCategory(data.category),
          status: normalizeStatus(data.status),
          priority: normalizePriority(data.priority),
          points: Number(data.points) || 0,
          progress: Number(data.progress) || 0,
          assigneeIds: Array.isArray(data.assigneeIds) ? data.assigneeIds : [],
          recurrence: normalizeRecurrence(data.recurrence),
          dueDate: toDate(data.dueDate),
          completedAt: toDate(data.completedAt),
          createdAt: toDate(data.createdAt),
        };
      })
      .sort((a, b) => {
        const ta = a.createdAt ? a.createdAt.getTime() : 0;
        const tb = b.createdAt ? b.createdAt.getTime() : 0;
        return tb - ta;
      });
    cb(list);
  });
}

export function createTask({
  familyId,
  userId,
  title,
  description,
  status,
  priority,
  category,
  points,
  dueDate,
  assigneeIds,
  progress,
  recurrence,
}) {
  const normStatus = normalizeStatus(status);
  return addDoc(tasksRef, {
    familyId,
    userId,
    title: title.trim(),
    description: description?.trim() || '',
    status: normStatus,
    priority: normalizePriority(priority),
    category: normalizeCategory(category),
    points: Math.max(0, Number(points) || 0),
    dueDate: Timestamp.fromDate(dueDate),
    assigneeIds: Array.isArray(assigneeIds) ? assigneeIds : [],
    progress: clampProgress(progress, normStatus),
    recurrence: normalizeRecurrence(recurrence),
    completedAt: normStatus === 'completed' ? serverTimestamp() : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateTask(id, fields) {
  const {
    title,
    description,
    status,
    priority,
    category,
    points,
    dueDate,
    assigneeIds,
    progress,
    previousStatus,
    recurrence,
  } = fields;
  const normStatus = normalizeStatus(status);
  const normRec = normalizeRecurrence(recurrence);

  // Recurring task being marked completed → roll forward to next occurrence
  // and reset to "planned" instead of finishing the series.
  if (normStatus === 'completed' && previousStatus !== 'completed' && normRec) {
    const next = nextOccurrenceAfter(dueDate, normRec);
    if (next) {
      return updateDoc(doc(db, 'tasks', id), {
        title: title.trim(),
        description: description?.trim() || '',
        status: 'planned',
        priority: normalizePriority(priority),
        category: normalizeCategory(category),
        points: Math.max(0, Number(points) || 0),
        dueDate: Timestamp.fromDate(next),
        assigneeIds: Array.isArray(assigneeIds) ? assigneeIds : [],
        progress: 0,
        recurrence: normRec,
        completedAt: null,
        updatedAt: serverTimestamp(),
      });
    }
  }

  const payload = {
    title: title.trim(),
    description: description?.trim() || '',
    status: normStatus,
    priority: normalizePriority(priority),
    category: normalizeCategory(category),
    points: Math.max(0, Number(points) || 0),
    dueDate: Timestamp.fromDate(dueDate),
    assigneeIds: Array.isArray(assigneeIds) ? assigneeIds : [],
    progress: clampProgress(progress, normStatus),
    recurrence: normRec,
    updatedAt: serverTimestamp(),
  };
  if (normStatus === 'completed' && previousStatus !== 'completed') {
    payload.completedAt = serverTimestamp();
  } else if (normStatus !== 'completed' && previousStatus === 'completed') {
    payload.completedAt = null;
  }
  return updateDoc(doc(db, 'tasks', id), payload);
}

// Lightweight status-only update for drag-and-drop. Handles the same
// completedAt/progress transitions as updateTask without requiring the full
// task payload. For recurring tasks moved to "completed", roll forward to
// the next occurrence and reset to "planned".
export function updateTaskStatus(id, status, previousStatus, task = null) {
  const normStatus = normalizeStatus(status);
  if (normStatus === previousStatus) return Promise.resolve();

  const rec = normalizeRecurrence(task?.recurrence);
  if (normStatus === 'completed' && previousStatus !== 'completed' && rec && task?.dueDate) {
    const next = nextOccurrenceAfter(task.dueDate, rec);
    if (next) {
      return updateDoc(doc(db, 'tasks', id), {
        status: 'planned',
        progress: 0,
        completedAt: null,
        dueDate: Timestamp.fromDate(next),
        updatedAt: serverTimestamp(),
      });
    }
  }

  const payload = {
    status: normStatus,
    updatedAt: serverTimestamp(),
  };
  if (normStatus === 'completed') {
    payload.completedAt = serverTimestamp();
    payload.progress = 100;
  } else if (previousStatus === 'completed') {
    payload.completedAt = null;
    if (normStatus === 'backlog' || normStatus === 'planned') payload.progress = 0;
  } else if (normStatus === 'backlog' || normStatus === 'planned') {
    payload.progress = 0;
  }
  return updateDoc(doc(db, 'tasks', id), payload);
}

export function deleteTask(id) {
  return deleteDoc(doc(db, 'tasks', id));
}
