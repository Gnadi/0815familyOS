import { addDays, format, isSameDay, startOfWeek } from 'date-fns';

const WEEK_OPTS = { weekStartsOn: 1 };

export function currentSprintMonday(now = new Date()) {
  return startOfWeek(now, WEEK_OPTS);
}

export function sprintMondayOf(date) {
  return startOfWeek(date, WEEK_OPTS);
}

export function isSameSprintWeek(date, monday) {
  return isSameDay(sprintMondayOf(date), monday);
}

export function tasksForSprint(tasks, monday = currentSprintMonday()) {
  return tasks.filter((t) => t.dueDate && isSameSprintWeek(t.dueDate, monday));
}

export function computeEfficiencyScore(tasks, monday = currentSprintMonday()) {
  const sprint = tasksForSprint(tasks, monday);
  const total = sprint.reduce((sum, t) => sum + (Number(t.points) || 0), 0);
  if (total === 0) return { score: 0, completedPoints: 0, totalPoints: 0 };
  const completedPoints = sprint
    .filter((t) => t.status === 'completed')
    .reduce((sum, t) => sum + (Number(t.points) || 0), 0);
  return {
    score: Math.round((completedPoints / total) * 100),
    completedPoints,
    totalPoints: total,
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
  return days.map((date) => {
    const dayTasks = tasks.filter(
      (t) => t.dueDate && isSameDay(t.dueDate, date) && t.status !== 'completed'
    );
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
