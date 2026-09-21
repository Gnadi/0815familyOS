// One sentence in, entries created. The endpoint for everything that is not
// the app itself: a Siri Shortcut, a Google Assistant routine bridged through
// an automation service, a Tasker task, a webhook, curl.
//
//   POST /api/agent
//   Authorization: Bearer <pairing token>      (or X-FAOS-Token, or ?token=)
//   { "text": "Friseur Carlo am Freitag um 16:00" }
//
//   -> 200 { "reply": "„Friseur Carlo\" am Fr., 25. September um 16:00 eingetragen.",
//            "created": [ { "type": "create_event", "id": "…" } ] }
//
// `reply` is one short sentence meant to be read out loud, in the language the
// pairing token was created with.
//
// GET /api/agent answers a health/configuration check without a token.
//
// The sentence is interpreted by the configured chatbot (api/_assistant/
// providers.js) exactly as the in-app microphone does. A caller that already
// has structured fields -- an MCP client, say -- should use /api/mcp instead
// and skip the interpretation step entirely.

import {
  ACTION_NAMES,
  MAX_TRANSCRIPT_CHARS,
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
import { rateLimit } from './_assistant/auth.js';
import { PairingError, resolvePairing, tokenFrom, touchPairing } from './_assistant/pairing.js';
import { FamilyError, loadFamilyContext } from './_assistant/family.js';
import { createEntries, normalizeForFamily } from './_assistant/create.js';
import { hasServiceAccount } from './_assistant/googleAuth.js';

const TIMEOUT_MS = 20_000;

const LANGUAGE_NAMES = { en: 'English', de: 'German' };

function weekday(date) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
}

const pad = (n) => String(n).padStart(2, '0');

// What is still missing before this endpoint can work at all.
export function missingConfiguration(config = resolveProviderConfig()) {
  const missing = [...config.missing];
  if (!hasServiceAccount()) missing.push('FIREBASE_SERVICE_ACCOUNT');
  return missing;
}

function fail(res, status, code, error) {
  res.status(status).json({ error, code });
}

export default async function handler(req, res) {
  const config = resolveProviderConfig();
  const missing = missingConfiguration(config);

  if (req.method === 'GET') {
    res.status(200).json({
      configured: missing.length === 0,
      provider: config.provider,
      model: config.model,
      missing,
    });
    return;
  }
  if (req.method !== 'POST') {
    fail(res, 405, 'method_not_allowed', 'Use POST with a JSON body.');
    return;
  }
  if (missing.length) {
    fail(res, 503, 'not_configured', `Voice interface not configured. Missing: ${missing.join(', ')}.`);
    return;
  }

  // 1. Who is calling.
  let pairing;
  try {
    pairing = await resolvePairing(tokenFrom(req));
  } catch (err) {
    if (err instanceof PairingError) {
      fail(res, 401, 'unauthorized', err.message);
      return;
    }
    fail(res, 502, 'backend_error', err?.message || 'Could not check the pairing token.');
    return;
  }
  if (!rateLimit(`agent:${pairing.token}`)) {
    fail(res, 429, 'rate_limited', 'Too many requests for this pairing token.');
    return;
  }

  // 2. What they said. Query parameters are accepted because several shortcut
  // editors cannot send a body.
  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  const text = String(body?.text ?? body?.transcript ?? req.query?.text ?? '').trim();
  if (!text) {
    fail(res, 400, 'empty_text', 'Send { "text": "…" }.');
    return;
  }
  if (text.length > MAX_TRANSCRIPT_CHARS) {
    fail(res, 413, 'text_too_long', 'That sentence is too long.');
    return;
  }
  const locale = body?.lang === 'de' || body?.lang === 'en' ? body.lang : pairing.locale;

  try {
    // 3. This family's own vocabulary.
    const family = await loadFamilyContext(pairing.familyId);
    const when = new Date();
    const context = sanitizeContext({
      today: `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`,
      nowTime: `${pad(when.getHours())}:${pad(when.getMinutes())}`,
      weekday: weekday(when),
      timezone: body?.timezone || '',
      language: LANGUAGE_NAMES[locale] || LANGUAGE_NAMES.en,
      categories: family.categories,
      taskCategories: family.taskCategories,
      kids: family.kids.map((k) => k.name),
      members: family.members.map((m) => m.name),
    });

    // 4. Let the chatbot decide which functions to call.
    const { url, init } = buildRequest({
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      systemPrompt: buildSystemPrompt(context),
      transcript: text,
      tools: buildToolDeclarations(context),
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let parsed;
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        fail(res, 502, 'provider_error', providerErrorMessage(json, response.status));
        return;
      }
      parsed = parseResponse(config.provider, json);
    } finally {
      clearTimeout(timer);
    }

    // 5. Validate against the family, then write.
    const { actions, skipped } = normalizeForFamily(
      parsed.actions.filter((a) => ACTION_NAMES.includes(a.type)),
      family,
      { userId: pairing.userId },
    );
    if (!actions.length) {
      res.status(200).json({
        reply:
          parsed.reply ||
          (locale === 'de'
            ? 'Daraus konnte ich keinen Eintrag machen. Sag am besten die Sache, den Tag und die Uhrzeit.'
            : 'I could not make an entry from that. Try naming the thing, the day and the time.'),
        created: [],
        skipped,
      });
      return;
    }

    const { created, failed } = await createEntries(actions, {
      familyId: pairing.familyId,
      userId: pairing.userId,
      locale,
    });
    await touchPairing(pairing.token, pairing.useCount);

    const reply = created.map((entry) => entry.summary).join(' ');
    res.status(created.length ? 200 : 502).json({
      reply: reply || (locale === 'de' ? 'Das hat nicht geklappt.' : 'That did not work.'),
      created: created.map(({ type, id, summary }) => ({ type, id, summary })),
      failed: failed.length ? failed : undefined,
      skipped: skipped || undefined,
    });
  } catch (err) {
    if (err instanceof FamilyError) {
      fail(res, 404, 'family_missing', err.message);
      return;
    }
    if (err?.name === 'AbortError') {
      fail(res, 504, 'timeout', 'The chatbot took too long to answer.');
      return;
    }
    fail(res, 502, 'backend_error', err?.message || 'Request failed.');
  }
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
