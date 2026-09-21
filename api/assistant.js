// Turns one spoken sentence into proposed calendar/task/shopping entries.
//
// Why a server endpoint at all: the provider API key must never reach the
// browser, and a Vite `VITE_*` variable is baked into the bundle for anyone to
// read. So the app sends the transcript here, this asks whichever chatbot is
// configured (see api/_assistant/providers.js) which of the app's functions to
// call, and hands the proposals back. Nothing is written to Firestore here --
// the client shows the proposals for confirmation and then writes them under
// the user's own credentials, so the Firestore rules keep doing their job and
// this endpoint needs no service-account key.
//
// GET  -> { configured, provider, model, missing, authRequired }  (settings screen)
// POST -> { actions, reply, provider, model }
//
// Configuration: docs/assistant-integration.md

import {
  MAX_ACTIONS,
  MAX_TRANSCRIPT_CHARS,
  ACTION_NAMES,
  buildSystemPrompt,
  buildToolDeclarations,
  sanitizeContext,
} from './_assistant/schema.js';
import {
  buildRequest,
  parseResponse,
  providerErrorMessage,
  resolveProviderConfig,
} from './_assistant/providers.js';
import { AuthError, bearerToken, rateLimit, verifyFirebaseIdToken } from './_assistant/auth.js';

const TIMEOUT_MS = 20_000;

// Anonymous access is opt-in and meant for local development only: without a
// verified caller the endpoint is an open invitation to spend someone's API
// quota.
const allowAnonymous = () => process.env.ASSISTANT_ALLOW_ANONYMOUS === 'true';

const projectId = () =>
  (process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '').trim();

function statusPayload(config) {
  return {
    configured: config.configured,
    provider: config.provider,
    model: config.model,
    missing: [
      ...config.missing,
      ...(allowAnonymous() || projectId() ? [] : ['FIREBASE_PROJECT_ID']),
    ],
    unknownProvider: config.unknownProvider || undefined,
    authRequired: !allowAnonymous(),
  };
}

export default async function handler(req, res) {
  const config = resolveProviderConfig();

  if (req.method === 'GET') {
    res.status(200).json(statusPayload(config));
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const status = statusPayload(config);
  if (status.missing.length) {
    res.status(503).json({
      error: `Assistant not configured. Missing: ${status.missing.join(', ')}.`,
      code: 'not_configured',
      missing: status.missing,
    });
    return;
  }

  let callerId = 'anonymous';
  if (!allowAnonymous()) {
    try {
      const { uid } = await verifyFirebaseIdToken(bearerToken(req), projectId());
      callerId = uid;
    } catch (err) {
      const message = err instanceof AuthError ? err.message : 'Could not verify sign-in.';
      res.status(401).json({ error: message, code: 'unauthorized' });
      return;
    }
  }

  if (!rateLimit(callerId)) {
    res.status(429).json({ error: 'Too many requests. Try again in a few minutes.', code: 'rate_limited' });
    return;
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  const transcript = typeof body?.transcript === 'string' ? body.transcript.trim() : '';
  if (!transcript) {
    res.status(400).json({ error: 'No transcript.', code: 'empty_transcript' });
    return;
  }
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    res.status(413).json({ error: 'Transcript too long.', code: 'transcript_too_long' });
    return;
  }

  const context = sanitizeContext(body?.context);
  const tools = buildToolDeclarations(context);
  const { url, init } = buildRequest({
    provider: config.provider,
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    systemPrompt: buildSystemPrompt(context),
    transcript,
    tools,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      res.status(502).json({
        error: providerErrorMessage(json, response.status),
        code: 'provider_error',
        provider: config.provider,
      });
      return;
    }

    const parsed = parseResponse(config.provider, json);
    // Only the functions this app actually implements, and only as many as a
    // single sentence could plausibly be asking for.
    const actions = parsed.actions
      .filter((a) => ACTION_NAMES.includes(a.type))
      .slice(0, MAX_ACTIONS);

    res.status(200).json({
      actions,
      reply: parsed.reply,
      provider: config.provider,
      model: config.model,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      res.status(504).json({ error: 'The assistant took too long to answer.', code: 'timeout' });
      return;
    }
    res.status(502).json({ error: err?.message || 'Assistant request failed.', code: 'provider_error' });
  } finally {
    clearTimeout(timer);
  }
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
