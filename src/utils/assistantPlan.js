// Everything between "the chatbot answered" and "the app writes a document".
//
// The model's answer is a suggestion from a third party, so nothing in it is
// trusted: every field is re-checked here against the family's real categories,
// children and members, dates are clamped to a sane window, and anything that
// cannot be made sense of is dropped rather than written. The result is a plan
// -- plain strings, ready to be shown in a form and edited -- which the review
// sheet turns into service calls only once the user has said yes.
//
// Kept pure (no Firebase, no React, no i18n) so the fiddly parts -- relative
// dates, misheard names, unknown categories -- are unit-testable:
// tests/unit/assistantPlan.spec.js

export const ASSISTANT_ACTION_TYPES = ['create_event', 'create_task', 'add_shopping_item'];

// The app has no all-day events and a task must carry a due date, so a
// proposal that names no time still needs one. Same default as Quick Add.
export const DEFAULT_EVENT_TIME = '09:00';
export const DEFAULT_TASK_TIME = '09:00';

const MAX_TITLE_CHARS = 120;
const MAX_DESCRIPTION_CHARS = 500;
const MAX_LOCATION_CHARS = 120;
const MAX_QUANTITY_CHARS = 40;
const MAX_POINTS = 100;

// How far a proposed date may sit from today. A year back covers "log last
// month's appointment"; five years ahead covers school and vaccination dates.
// Anything outside is a hallucinated or misparsed year, not an intention.
const PAST_DAYS_ALLOWED = 365;
const FUTURE_DAYS_ALLOWED = 5 * 365;
const DAY_MS = 24 * 60 * 60 * 1000;

const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

// Weekday names for the prompt stay English whatever the UI language: they are
// read by the model, not by the user.
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const LANGUAGE_NAMES = { en: 'English', de: 'German' };

// Relative days the model is asked to resolve itself. It normally does, but a
// smaller model occasionally echoes the word instead, and losing a whole
// sentence over that would be a poor trade.
const RELATIVE_DAYS = {
  today: 0, heute: 0,
  tomorrow: 1, morgen: 1,
  'day after tomorrow': 2, ubermorgen: 2,
  yesterday: -1, gestern: -1,
};

// Diacritics folded and case dropped, so "Ubermorgen", "übermorgen" and
// "Gesundheit " all compare equal to their catalogue entry.
export function fold(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function clampText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toDateString(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// 'YYYY-MM-DD' for anything we can make sense of, '' otherwise.
export function normalizeDateString(value, now = new Date()) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const raw = value.trim();

  const relative = RELATIVE_DAYS[fold(raw)];
  if (relative !== undefined) {
    return toDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + relative));
  }

  // Leading YYYY-MM-DD, so a full ISO timestamp works too.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return '';
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  // Rejects 2026-02-31 and friends: Date rolls them over to another day.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return '';

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const distance = (date.getTime() - today.getTime()) / DAY_MS;
  if (distance < -PAST_DAYS_ALLOWED || distance > FUTURE_DAYS_ALLOWED) return '';
  return toDateString(date);
}

// 'HH:MM' for anything time-shaped ("9", "9:5", "09.30", "14:00:00"), else ''.
export function normalizeTimeString(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const match = /^(\d{1,2})(?:[:.h\s]\s*(\d{1,2}))?/.exec(value.trim());
  if (!match) return '';
  const hours = Number(match[1]);
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  if (!Number.isInteger(hours) || hours > 23) return '';
  if (!Number.isInteger(minutes) || minutes > 59) return '';
  return `${pad2(hours)}:${pad2(minutes)}`;
}

// A Date built from the plan's own strings, so what the review sheet shows is
// exactly what gets written.
export function toDateTime(dateString, timeString, fallbackTime = DEFAULT_EVENT_TIME) {
  const date = normalizeDateString(dateString) || dateString;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const [hh, mm] = (normalizeTimeString(timeString) || fallbackTime).split(':').map(Number);
  const result = new Date(y, m - 1, d, hh, mm);
  return Number.isNaN(result.getTime()) ? null : result;
}

// Match a spoken or model-chosen value against the family's own catalogue:
// by id first (what the model was asked for), then by label, then by prefix.
export function matchOption(value, options, fallback = '') {
  const needle = fold(value);
  if (!needle || !Array.isArray(options)) return fallback;
  const byId = options.find((o) => fold(o?.id) === needle);
  if (byId) return byId.id;
  const byLabel = options.find((o) => fold(o?.label) === needle);
  if (byLabel) return byLabel.id;
  const byPrefix = options.find(
    (o) => fold(o?.label) && (fold(o.label).startsWith(needle) || needle.startsWith(fold(o.label))),
  );
  return byPrefix ? byPrefix.id : fallback;
}

// Names (possibly misheard, possibly already ids) onto roster ids.
// `people` is [{ id, name }]; order and duplicates of the input are ignored.
export function matchPeople(values, people) {
  if (!Array.isArray(values) || !Array.isArray(people)) return [];
  const ids = [];
  for (const value of values) {
    const needle = fold(value);
    if (!needle) continue;
    const hit =
      people.find((p) => fold(p?.id) === needle) ||
      people.find((p) => fold(p?.name) === needle) ||
      // First name only, or a name that swallowed a neighbouring word.
      people.find((p) => {
        const name = fold(p?.name);
        return name && (name.split(' ')[0] === needle || needle.startsWith(`${name} `));
      });
    if (hit && !ids.includes(hit.id)) ids.push(hit.id);
  }
  return ids;
}

export function normalizeRecurrence(raw, now = new Date()) {
  if (!raw || typeof raw !== 'object') return null;
  const freq = FREQUENCIES.includes(fold(raw.freq)) ? fold(raw.freq) : '';
  if (!freq) return null;
  const interval = Math.max(1, Math.min(99, Math.round(Number(raw.interval) || 1)));
  const until = normalizeDateString(raw.until, now);
  return { freq, interval, until: until || null };
}

function normalizeEvent(args, opts) {
  const title = clampText(args.title, MAX_TITLE_CHARS);
  const date = normalizeDateString(args.date, opts.now);
  if (!title || !date) return null;
  const time = normalizeTimeString(args.time) || DEFAULT_EVENT_TIME;
  const endTime = normalizeTimeString(args.endTime);
  return {
    type: 'create_event',
    title,
    date,
    time,
    // An end before the start is a misheard range, not an overnight event.
    endTime: endTime && endTime > time ? endTime : '',
    location: clampText(args.location, MAX_LOCATION_CHARS),
    description: clampText(args.description, MAX_DESCRIPTION_CHARS),
    category: matchOption(args.category, opts.categories, opts.defaultCategory),
    kidIds: matchPeople(args.kids, opts.kids),
    responsibleParent: resolveResponsible(args.responsible, opts),
    recurrence: normalizeRecurrence(args.recurrence, opts.now),
  };
}

// Events carry the responsible adult by display name (see EventFormModal), so
// this resolves to a name rather than a uid.
function resolveResponsible(value, opts) {
  const [id] = matchPeople([value], opts.members);
  if (id) return opts.members.find((m) => m.id === id)?.name || '';
  return opts.defaultResponsible || '';
}

function normalizeTask(args, opts) {
  const title = clampText(args.title, MAX_TITLE_CHARS);
  if (!title) return null;
  return {
    type: 'create_task',
    title,
    // A task document must carry a due date; "sometime" becomes today, which
    // the review sheet shows as an ordinary editable date.
    dueDate: normalizeDateString(args.dueDate, opts.now) || toDateString(opts.now),
    description: clampText(args.description, MAX_DESCRIPTION_CHARS),
    priority: PRIORITIES.includes(fold(args.priority)) ? fold(args.priority) : 'normal',
    category: matchOption(args.category, opts.taskCategories, opts.defaultTaskCategory),
    points: Math.max(0, Math.min(MAX_POINTS, Math.round(Number(args.points) || 0))),
    assigneeIds: matchPeople(args.assignees, opts.members),
  };
}

function normalizeShoppingItem(args) {
  const title = clampText(args.title, MAX_TITLE_CHARS);
  if (!title) return null;
  return {
    type: 'add_shopping_item',
    title,
    quantity: clampText(args.quantity, MAX_QUANTITY_CHARS),
  };
}

// The family data every proposal is validated against. `categories` and
// `taskCategories` are [{ id, label }]; `kids` and `members` are [{ id, name }].
function withDefaults(options = {}) {
  return {
    now: options.now instanceof Date ? options.now : new Date(),
    categories: options.categories || [],
    taskCategories: options.taskCategories || [],
    kids: options.kids || [],
    members: options.members || [],
    defaultCategory: options.defaultCategory || '',
    defaultTaskCategory: options.defaultTaskCategory || '',
    defaultResponsible: options.defaultResponsible || '',
  };
}

// [{ type, args }] from the endpoint -> [{ id, type, ...fields }] for the UI.
// `skipped` counts proposals that were unusable (no title, nonsense date,
// unknown action), so the sheet can say so instead of silently shrinking.
export function normalizeAssistantActions(raw, options = {}) {
  const opts = withDefaults(options);
  const actions = [];
  let skipped = 0;

  (Array.isArray(raw) ? raw : []).forEach((entry, index) => {
    const type = entry?.type;
    const args = entry?.args && typeof entry.args === 'object' ? entry.args : {};
    let action = null;
    if (type === 'create_event') action = normalizeEvent(args, opts);
    else if (type === 'create_task') action = normalizeTask(args, opts);
    else if (type === 'add_shopping_item') action = normalizeShoppingItem(args);

    if (action) actions.push({ id: `${type}-${index}`, ...action });
    else skipped += 1;
  });

  return { actions, skipped };
}

// What the model is told before it sees the sentence. Only first names,
// category labels and the clock -- no ids, no addresses, no existing entries.
export function buildAssistantContext({
  now = new Date(),
  locale = 'en',
  timezone = '',
  categories = [],
  taskCategories = [],
  kids = [],
  members = [],
} = {}) {
  return {
    today: toDateString(now),
    nowTime: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
    weekday: WEEKDAYS[now.getDay()],
    timezone,
    language: LANGUAGE_NAMES[locale] || LANGUAGE_NAMES.en,
    categories: categories.map((c) => ({ id: c.id, label: c.label })),
    taskCategories: taskCategories.map((c) => ({ id: c.id, label: c.label })),
    kids: kids.map((k) => k.name).filter(Boolean),
    members: members.map((m) => m.name).filter(Boolean),
  };
}

// --- plan -> service payloads -------------------------------------------------

export function planToEventPayload(action) {
  return {
    title: action.title,
    description: action.description || '',
    date: toDateTime(action.date, action.time, DEFAULT_EVENT_TIME),
    endDate: action.endTime ? toDateTime(action.date, action.endTime, action.endTime) : null,
    location: action.location || '',
    category: action.category || undefined,
    kids: action.kidIds || [],
    responsibleParent: action.responsibleParent || '',
    effortLevel: '',
    recurrence: action.recurrence || null,
  };
}

export function planToTaskPayload(action) {
  return {
    title: action.title,
    description: action.description || '',
    status: 'planned',
    priority: action.priority || 'normal',
    category: action.category || undefined,
    points: action.points || 0,
    dueDate: toDateTime(action.dueDate, '', DEFAULT_TASK_TIME),
    assigneeIds: action.assigneeIds || [],
    progress: 0,
  };
}

export function planToShoppingPayload(action) {
  return { title: action.title, quantity: action.quantity || '' };
}
