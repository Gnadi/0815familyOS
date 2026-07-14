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
import { isDemoMode } from '../lib/demoMode';
import { demoAdd, demoDelete, demoSubscribe, demoUpdate } from './demoStore';

const tasksRef = collection(db, 'tasks');

const nowVal = () => (isDemoMode() ? new Date() : serverTimestamp());
const dateVal = (d) => (isDemoMode() ? d : Timestamp.fromDate(d));

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
  if (isDemoMode()) return demoSubscribe('tasks', (docs) => cb(mapTaskDocs(docs)));
  const q = query(tasksRef, where('familyId', '==', familyId));
  return onSnapshot(q, (snap) => cb(mapTaskDocs(snap.docs)));
}

function mapTaskDocs(docs) {
  return docs
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
  const payload = {
    familyId,
    userId,
    title: title.trim(),
    description: description?.trim() || '',
    status: normStatus,
    priority: normalizePriority(priority),
    category: normalizeCategory(category),
    points: Math.max(0, Number(points) || 0),
    dueDate: dateVal(dueDate),
    assigneeIds: Array.isArray(assigneeIds) ? assigneeIds : [],
    progress: clampProgress(progress, normStatus),
    recurrence: normalizeRecurrence(recurrence),
    completedAt: normStatus === 'completed' ? nowVal() : null,
    createdAt: nowVal(),
    updatedAt: nowVal(),
  };
  if (isDemoMode()) return demoAdd('tasks', payload);
  return addDoc(tasksRef, payload);
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
      const rollForward = {
        title: title.trim(),
        description: description?.trim() || '',
        status: 'planned',
        priority: normalizePriority(priority),
        category: normalizeCategory(category),
        points: Math.max(0, Number(points) || 0),
        dueDate: dateVal(next),
        assigneeIds: Array.isArray(assigneeIds) ? assigneeIds : [],
        progress: 0,
        recurrence: normRec,
        completedAt: null,
        updatedAt: nowVal(),
      };
      if (isDemoMode()) return demoUpdate('tasks', id, rollForward);
      return updateDoc(doc(db, 'tasks', id), rollForward);
    }
  }

  const payload = {
    title: title.trim(),
    description: description?.trim() || '',
    status: normStatus,
    priority: normalizePriority(priority),
    category: normalizeCategory(category),
    points: Math.max(0, Number(points) || 0),
    dueDate: dateVal(dueDate),
    assigneeIds: Array.isArray(assigneeIds) ? assigneeIds : [],
    progress: clampProgress(progress, normStatus),
    recurrence: normRec,
    updatedAt: nowVal(),
  };
  if (normStatus === 'completed' && previousStatus !== 'completed') {
    payload.completedAt = nowVal();
  } else if (normStatus !== 'completed' && previousStatus === 'completed') {
    payload.completedAt = null;
  }
  if (isDemoMode()) return demoUpdate('tasks', id, payload);
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
      const rollForward = {
        status: 'planned',
        progress: 0,
        completedAt: null,
        dueDate: dateVal(next),
        updatedAt: nowVal(),
      };
      if (isDemoMode()) return demoUpdate('tasks', id, rollForward);
      return updateDoc(doc(db, 'tasks', id), rollForward);
    }
  }

  const payload = {
    status: normStatus,
    updatedAt: nowVal(),
  };
  if (normStatus === 'completed') {
    payload.completedAt = nowVal();
    payload.progress = 100;
  } else if (previousStatus === 'completed') {
    payload.completedAt = null;
    if (normStatus === 'backlog' || normStatus === 'planned') payload.progress = 0;
  } else if (normStatus === 'backlog' || normStatus === 'planned') {
    payload.progress = 0;
  }
  if (isDemoMode()) return demoUpdate('tasks', id, payload);
  return updateDoc(doc(db, 'tasks', id), payload);
}

export function deleteTask(id) {
  if (isDemoMode()) return demoDelete('tasks', id);
  return deleteDoc(doc(db, 'tasks', id));
}
