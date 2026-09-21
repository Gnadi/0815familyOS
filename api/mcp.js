// An MCP server for myFAOS: the port a chatbot plugs into.
//
// Model Context Protocol is what Gemini's Connected Apps, ChatGPT's custom
// connectors, Claude and Gemini CLI all speak, so one endpoint covers all of
// them. The chatbot asks for the tool list, fills the arguments itself (it
// already knows today's date and what the person said), and calls a tool --
// which means no second model is needed here and nothing has to be parsed
// twice.
//
//   POST /api/mcp                      JSON-RPC 2.0, Streamable HTTP
//   Authorization: Bearer <pairing token>
//   ?token=<pairing token>             for clients that only take a URL
//
// Tools: create_event, create_task, add_shopping_item -- the same three the
// in-app microphone offers, with this family's own categories and children
// baked into their schemas.
//
// Deliberately absent: anything that reads, changes or deletes. A pairing
// token pasted into a chatbot can add to the family's lists and nothing else.

import { buildToolDeclarations, sanitizeContext } from './_assistant/schema.js';
import { rateLimit } from './_assistant/auth.js';
import { PairingError, resolvePairing, tokenFrom, touchPairing } from './_assistant/pairing.js';
import { FamilyError, loadFamilyContext } from './_assistant/family.js';
import { createEntries, normalizeForFamily } from './_assistant/create.js';
import { hasServiceAccount } from './_assistant/googleAuth.js';

const SERVER_INFO = { name: 'myfaos', title: 'myFAOS', version: '1.0.0' };
const DEFAULT_PROTOCOL = '2025-06-18';
const SUPPORTED_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

// Streamable HTTP allows a POST to be answered with either a JSON body or a
// one-event SSE stream. Plain JSON is simpler, so it stays the default -- but
// a client that advertises only text/event-stream gets what it asked for
// rather than a content-type it refuses to parse.
function respond(req, res, payload, status = 200) {
  const accept = String(req.headers?.accept || '');
  const wantsStream = accept.includes('text/event-stream') && !accept.includes('application/json');
  if (wantsStream && typeof res.end === 'function') {
    res.status(status);
    res.setHeader('content-type', 'text/event-stream');
    res.setHeader('cache-control', 'no-cache');
    res.end(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
    return;
  }
  res.status(status).json(payload);
}

// JSON-RPC error codes used here: -32601 unknown method, -32602 bad params,
// -32603 internal.
function textContent(text, isError = false) {
  return { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) };
}

function toolsFor(family) {
  // The context only shapes the schema (which ids and names are valid), so the
  // date fields are irrelevant here and left empty.
  const context = sanitizeContext({
    categories: family.categories,
    taskCategories: family.taskCategories,
    kids: family.kids.map((k) => k.name),
    members: family.members.map((m) => m.name),
  });
  return buildToolDeclarations(context).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.parameters,
  }));
}

async function callTool(params, pairing, family) {
  const name = params?.name;
  const args = params?.arguments && typeof params.arguments === 'object' ? params.arguments : {};

  const { actions } = normalizeForFamily([{ type: name, args }], family, {
    userId: pairing.userId,
  });
  if (!actions.length) {
    // Tell the model what to fix rather than failing silently -- it can call
    // again with a corrected argument in the same turn.
    return textContent(
      `Nothing could be created from those arguments. "${name}" needs at least a title`
      + `${name === 'create_event' ? ' and a date as YYYY-MM-DD' : ''}, and dates must be`
      + ' absolute (resolve "tomorrow" or "next Friday" yourself first).',
      true,
    );
  }

  const { created, failed } = await createEntries(actions, {
    familyId: pairing.familyId,
    userId: pairing.userId,
    locale: pairing.locale,
  });
  await touchPairing(pairing.token, pairing.useCount);

  if (!created.length) {
    return textContent(`Could not save it: ${failed[0]?.message || 'unknown error'}.`, true);
  }
  return textContent(created.map((entry) => entry.summary).join(' '));
}

// One JSON-RPC message. `family` is loaded lazily: initialize and ping must
// answer even if the family document is unreachable.
async function dispatch(message, pairing, loadFamily) {
  const { id, method, params } = message || {};

  if (method === 'initialize') {
    const asked = params?.protocolVersion;
    return rpcResult(id, {
      protocolVersion: SUPPORTED_PROTOCOLS.includes(asked) ? asked : DEFAULT_PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions:
        'Adds entries to this family\'s shared calendar, task board and shopping list. '
        + 'Resolve spoken dates into absolute YYYY-MM-DD values and 24h HH:MM times before calling a tool.',
    });
  }
  if (method === 'ping') return rpcResult(id, {});
  if (method === 'tools/list') return rpcResult(id, { tools: toolsFor(await loadFamily()) });
  if (method === 'tools/call') {
    if (!params?.name) return rpcError(id, -32602, 'Missing tool name.');
    return rpcResult(id, await callTool(params, pairing, await loadFamily()));
  }
  // Nothing else is offered: no resources, no prompts, no sampling.
  if (method === 'resources/list') return rpcResult(id, { resources: [] });
  if (method === 'prompts/list') return rpcResult(id, { prompts: [] });
  return rpcError(id, -32601, `Unknown method: ${method}`);
}

export default async function handler(req, res) {
  if (req.method === 'GET' || req.method === 'DELETE') {
    // No server-initiated stream and no session to end: this server is
    // stateless, which Streamable HTTP allows.
    res.status(405).json({ error: 'This MCP endpoint only accepts POST.' });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }
  if (!hasServiceAccount()) {
    res.status(503).json({ error: 'Voice interface not configured: FIREBASE_SERVICE_ACCOUNT is missing.' });
    return;
  }

  let pairing;
  try {
    pairing = await resolvePairing(tokenFrom(req));
  } catch (err) {
    if (err instanceof PairingError) {
      // 401 is what an MCP client needs to see to ask for credentials again.
      res.status(401).json({ error: err.message });
      return;
    }
    res.status(502).json({ error: err?.message || 'Could not check the pairing token.' });
    return;
  }
  if (!rateLimit(`mcp:${pairing.token}`)) {
    res.status(429).json({ error: 'Too many requests for this pairing token.' });
    return;
  }

  let cachedFamily = null;
  const loadFamily = async () => {
    if (!cachedFamily) cachedFamily = await loadFamilyContext(pairing.familyId);
    return cachedFamily;
  };

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  const messages = Array.isArray(body) ? body : [body];
  if (!messages.length || !messages[0] || typeof messages[0] !== 'object') {
    res.status(400).json(rpcError(null, -32700, 'Expected a JSON-RPC message.'));
    return;
  }

  try {
    const answers = [];
    for (const message of messages) {
      const answer = await dispatch(message, pairing, loadFamily);
      // A notification (no id) gets no reply.
      if (message?.id !== undefined && message?.id !== null) answers.push(answer);
    }
    if (!answers.length) {
      res.status(202).json({});
      return;
    }
    respond(req, res, Array.isArray(body) ? answers : answers[0]);
  } catch (err) {
    const status = err instanceof FamilyError ? 404 : 500;
    respond(req, res, rpcError(messages[0]?.id ?? null, -32603, err?.message || 'Internal error.'), status);
  }
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
