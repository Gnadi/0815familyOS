import { addDays, format, isSameDay, startOfWeek } from 'date-fns';
import { SPRINT_STATUSES } from '../constants/taskCategories';

const WEEK_OPTS = { weekStartsOn: 1 };

export function currentSprintMonday(now = new Date()) {
  return startOfWeek(now, WEEK_OPTS);
}

// Sprint scope = everything the family has pulled out of the backlog.
// Backlog items are explicitly excluded — they haven't been committed to yet.
export function tasksInSprint(tasks) {
  return tasks.filter((t) => SPRINT_STATUSES.includes(t.status));
}

export function computeEfficiencyScore(tasks) {
  const sprint = tasksInSprint(tasks);
  const totalPoints = sprint.reduce((sum, t) => sum + (Number(t.points) || 0), 0);
  if (totalPoints === 0) return { score: 0, completedPoints: 0, totalPoints: 0 };
  const completedPoints = sprint
    .filter((t) => t.status === 'completed')
    .reduce((sum, t) => sum + (Number(t.points) || 0), 0);
  return {
    score: Math.round((completedPoints / totalPoints) * 100),
    completedPoints,
    totalPoints,
  };
}

// Load buckets tuned for a household-scale sprint. Tweak thresholds freely.
function bucketLoad(points) {
  if (points <= 0) return 'none';
  if (points <= 5) return 'low';
  if (points <= 12) return 'mid';
  return 'high';
}

export function computeCapacityLoad(tasks, monday = currentSprintMonday()) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  // Capacity reflects work the family has committed to — backlog items are
  // excluded, completed items no longer consume capacity.
  const committed = tasks.filter(
    (t) => t.status === 'planned' || t.status === 'inProgress'
  );
  return days.map((date) => {
    const dayTasks = committed.filter((t) => t.dueDate && isSameDay(t.dueDate, date));
    const points = dayTasks.reduce((sum, t) => sum + (Number(t.points) || 0), 0);
    return {
      date,
      label: format(date, 'EEE').toUpperCase(),
      points,
      level: bucketLoad(points),
      tasks: dayTasks,
    };
  });
}

// Column summary row: "Est. Points · 24 pts · High Priority" etc.
export function summaryForColumn(status, tasks) {
  const filtered = tasks.filter((t) => t.status === status);
  const points = filtered.reduce((sum, t) => sum + (Number(t.points) || 0), 0);
  const count = filtered.length;

  if (status === 'backlog') {
    const hasUrgent = filtered.some(
      (t) => t.priority === 'urgent' || t.priority === 'high'
    );
    return {
      count,
      points,
      leftLabel: 'Est. Points',
      rightLabel: hasUrgent ? 'High Priority' : 'Queued',
      rightTone: hasUrgent ? 'text-red-600' : 'text-slate-500',
    };
  }

  if (status === 'planned') {
    const hasUrgent = filtered.some(
      (t) => t.priority === 'urgent' || t.priority === 'high'
    );
    return {
      count,
      points,
      leftLabel: 'Sprint Scope',
      rightLabel: hasUrgent ? 'High Priority' : 'Ready',
      rightTone: hasUrgent ? 'text-red-600' : 'text-cyan-600',
    };
  }

  if (status === 'inProgress') {
    const peak = filtered.some((t) => (t.progress || 0) >= 70);
    return {
      count,
      points,
      leftLabel: 'Active Load',
      rightLabel: peak ? 'Peak Phase' : 'Flowing',
      rightTone: peak ? 'text-amber-600' : 'text-brand-600',
    };
  }

  // completed
  const byDay = filtered.reduce((acc, t) => {
    const when = t.completedAt || t.dueDate;
    if (!when) return acc;
    const key = format(when, 'EEE');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const best = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
  return {
    count,
    points,
    leftLabel: 'Output',
    rightLabel: best ? `${best[0]} Best` : 'Fresh Sprint',
    rightTone: 'text-emerald-600',
  };
}

// Stable colour per uid so each member's avatar is recognisable across cards.
export function hashToIndex(str, modulo) {
  let hash = 5381;
  for (let i = 0; i < (str || '').length; i += 1) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash % modulo;
}

export function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
