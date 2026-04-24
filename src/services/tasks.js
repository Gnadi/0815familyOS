import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DEFAULT_TASK_CATEGORY } from '../constants/taskCategories';

const tasksRef = collection(db, 'tasks');

function normalizeCategory(category) {
  return typeof category === 'string' && category.trim() ? category : DEFAULT_TASK_CATEGORY;
}

function normalizeStatus(status) {
  return ['backlog', 'inProgress', 'completed'].includes(status) ? status : 'backlog';
}

function normalizePriority(priority) {
  return ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal';
}

function clampProgress(progress, status) {
  const n = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
  if (status === 'completed') return 100;
  if (status === 'backlog') return 0;
  return n;
}

function toDate(value) {
  if (!value) return null;
  return value?.toDate ? value.toDate() : value;
}

export function subscribeTasks(familyId, cb) {
  const q = query(
    tasksRef,
    where('familyId', '==', familyId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => {
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
        dueDate: toDate(data.dueDate),
        completedAt: toDate(data.completedAt),
      };
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
  } = fields;
  const normStatus = normalizeStatus(status);
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
    updatedAt: serverTimestamp(),
  };
  if (normStatus === 'completed' && previousStatus !== 'completed') {
    payload.completedAt = serverTimestamp();
  } else if (normStatus !== 'completed' && previousStatus === 'completed') {
    payload.completedAt = null;
  }
  return updateDoc(doc(db, 'tasks', id), payload);
}

export function deleteTask(id) {
  return deleteDoc(doc(db, 'tasks', id));
}
