// Client half of the voice assistant: ask /api/assistant what a sentence
// means, then write the confirmed plan with the user's own credentials.
//
// The write deliberately happens here rather than on the server: every
// document goes through the same service functions the forms use, so the
// Firestore rules (and demo mode) apply unchanged and the endpoint never needs
// admin access to the family's data.

import { auth } from '../lib/firebase';
import { createEvent } from './events';
import { createTask } from './tasks';
import { createShoppingItem } from './shopping';
import { guessProductIcon } from '../utils/productIcons';
import {
  planToEventPayload,
  planToShoppingPayload,
  planToTaskPayload,
} from '../utils/assistantPlan';

const ENDPOINT = '/api/assistant';

async function idToken() {
  try {
    return (await auth?.currentUser?.getIdToken()) || '';
  } catch {
    return '';
  }
}

// Whether a chatbot is wired up at all, and which one. Used by Settings to
// show a status instead of letting the first voice attempt fail mysteriously.
export async function fetchAssistantStatus() {
  const res = await fetch(ENDPOINT, { method: 'GET' });
  if (!res.ok) throw new Error(`Status check failed (HTTP ${res.status}).`);
  return res.json();
}

function requestError(json, res) {
  const error = new Error(json?.error || `Assistant request failed (HTTP ${res.status}).`);
  error.code = json?.code || '';
  error.missing = json?.missing || [];
  return error;
}

export async function interpretTranscript({ transcript, context, signal }) {
  const headers = { 'content-type': 'application/json' };
  const token = await idToken();
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ transcript, context }),
    signal,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw requestError(json, res);

  return {
    actions: Array.isArray(json?.actions) ? json.actions : [],
    reply: typeof json?.reply === 'string' ? json.reply : '',
    provider: json?.provider || '',
    model: json?.model || '',
  };
}

async function runAction(action, { familyId, userId }) {
  if (action.type === 'create_event') {
    return createEvent({ familyId, userId, ...planToEventPayload(action) });
  }
  if (action.type === 'create_task') {
    return createTask({ familyId, userId, ...planToTaskPayload(action) });
  }
  if (action.type === 'add_shopping_item') {
    const payload = planToShoppingPayload(action);
    return createShoppingItem({
      familyId,
      userId,
      ...payload,
      icon: guessProductIcon(payload.title),
    });
  }
  throw new Error(`Unknown assistant action: ${action.type}`);
}

// Writes every confirmed action, one at a time, and reports what did not make
// it rather than aborting the batch: if two of three entries were saved, the
// user needs to know which one to repeat.
export async function applyAssistantActions(actions, { familyId, userId }) {
  const failed = [];
  let created = 0;
  for (const action of actions) {
    try {
      await runAction(action, { familyId, userId });
      created += 1;
    } catch (err) {
      failed.push({ action, message: err?.message || 'Write failed.' });
    }
  }
  return { created, failed };
}
