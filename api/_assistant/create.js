// Writing what a chatbot proposed, server-side.
//
// The in-app assistant hands its proposals to the user first and then writes
// them from the browser. A voice assistant has nobody to confirm with -- the
// family is in the hallway with wet hands -- so these writes happen here, and
// the safety that the review sheet provided has to come from validation
// instead: every action goes through the same normalizeAssistantActions() the
// app uses, against this family's real categories, children and members.
//
// familyId and userId always come from the pairing token. Nothing in the
// request body can change them.

import {
  DEFAULT_EVENT_TIME,
  normalizeAssistantActions,
  planToEventPayload,
  planToShoppingPayload,
  planToTaskPayload,
} from '../../src/utils/assistantPlan.js';
import { DEFAULT_CATEGORY } from '../../src/constants/eventCategories.js';
import { DEFAULT_TASK_CATEGORY } from '../../src/constants/taskCategories.js';
import { guessProductIcon } from '../../src/utils/productIcons.js';
import { createDocument } from './firestore.js';

// The REST API has no serverTimestamp() sentinel, so "now" is this server's
// clock -- a few milliseconds off what the client SDK would have written.
const now = () => new Date();

export function normalizeForFamily(rawActions, context, { userId = '' } = {}) {
  return normalizeAssistantActions(rawActions, {
    now: now(),
    categories: context.categories,
    taskCategories: context.taskCategories,
    kids: context.kids,
    members: context.members,
    defaultCategory: DEFAULT_CATEGORY,
    defaultTaskCategory: DEFAULT_TASK_CATEGORY,
    // Who the entry is "from" when the sentence does not say: the member whose
    // pairing token this is.
    defaultResponsible: context.members.find((m) => m.id === userId)?.name || '',
  });
}

function eventDocument(action, { familyId, userId }) {
  const payload = planToEventPayload(action);
  return {
    familyId,
    userId,
    title: payload.title,
    description: payload.description,
    category: payload.category || DEFAULT_CATEGORY,
    date: payload.date,
    endDate: payload.endDate,
    location: payload.location,
    kids: payload.kids,
    responsibleParent: payload.responsibleParent,
    effortLevel: '',
    // Same shape the client writes, including the .ics-only fields, so a
    // series created by voice reads back identically.
    recurrence: payload.recurrence
      ? { ...payload.recurrence, byDay: null, count: null, exdates: null }
      : null,
    createdAt: now(),
    updatedAt: now(),
  };
}

function taskDocument(action, { familyId, userId }) {
  const payload = planToTaskPayload(action);
  return {
    familyId,
    userId,
    title: payload.title,
    description: payload.description,
    status: 'planned',
    priority: payload.priority,
    category: payload.category || DEFAULT_TASK_CATEGORY,
    points: payload.points,
    dueDate: payload.dueDate,
    assigneeIds: payload.assigneeIds,
    progress: 0,
    recurrence: null,
    completedAt: null,
    createdAt: now(),
    updatedAt: now(),
  };
}

function shoppingDocument(action, { familyId, userId }) {
  const payload = planToShoppingPayload(action);
  return {
    familyId,
    userId,
    title: payload.title,
    quantity: payload.quantity,
    icon: guessProductIcon(payload.title),
    urgent: false,
    offer: false,
    ifConvenient: false,
    done: false,
    createdAt: now(),
    updatedAt: now(),
    completedAt: null,
  };
}

const WRITERS = {
  create_event: { collection: 'events', build: eventDocument },
  create_task: { collection: 'tasks', build: taskDocument },
  add_shopping_item: { collection: 'shoppingItems', build: shoppingDocument },
};

// A confirmation a voice assistant can read out. Deliberately short: the
// chatbot usually rephrases it anyway, and a long sentence is a long wait.
export function summarize(action, locale = 'en') {
  const de = locale === 'de';
  if (action.type === 'add_shopping_item') {
    const what = action.quantity ? `${action.quantity} ${action.title}` : action.title;
    return de ? `${what} steht auf der Einkaufsliste.` : `${what} is on the shopping list.`;
  }
  const isEvent = action.type === 'create_event';
  const day = isEvent ? action.date : action.dueDate;
  const parts = day ? day.split('-').map(Number) : null;
  const date = parts ? new Date(parts[0], parts[1] - 1, parts[2]) : null;
  const dayLabel = date
    ? new Intl.DateTimeFormat(de ? 'de-DE' : 'en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
      }).format(date)
    : '';

  if (isEvent) {
    const time = action.time || DEFAULT_EVENT_TIME;
    return de
      ? `„${action.title}" am ${dayLabel} um ${time} eingetragen.`
      : `"${action.title}" added on ${dayLabel} at ${time}.`;
  }
  return de
    ? `Aufgabe „${action.title}" bis ${dayLabel} angelegt.`
    : `Task "${action.title}" created, due ${dayLabel}.`;
}

// Writes every action it was given. One failure does not abort the rest: if
// two of three entries made it, the caller has to be able to say which one
// did not.
export async function createEntries(actions, { familyId, userId, locale = 'en' }) {
  const created = [];
  const failed = [];

  for (const action of actions) {
    const writer = WRITERS[action.type];
    if (!writer) {
      failed.push({ type: action.type, message: 'Unsupported action.' });
      continue;
    }
    try {
      const id = await createDocument(writer.collection, writer.build(action, { familyId, userId }));
      created.push({ type: action.type, id, summary: summarize(action, locale), action });
    } catch (err) {
      failed.push({ type: action.type, message: err?.message || 'Write failed.' });
    }
  }

  return { created, failed };
}
