import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Firestore is the only I/O these endpoints do besides the chatbot call, so it
// is mocked and every assertion below is about what they *would* write.
vi.mock('../../api/_assistant/firestore.js', () => ({
  getDocument: vi.fn(),
  createDocument: vi.fn(),
  patchDocument: vi.fn(),
  FirestoreError: class FirestoreError extends Error {},
}));

const { createDocument, getDocument, patchDocument } = await import(
  '../../api/_assistant/firestore.js'
);
const { default: agentHandler } = await import('../../api/agent.js');
const { default: mcpHandler } = await import('../../api/mcp.js');
const { default: openApiHandler } = await import('../../api/openapi.js');
const { resolvePairing, tokenFrom, PairingError } = await import('../../api/_assistant/pairing.js');

const TOKEN = 'faos_TESTTOKEN123456';

const FAMILY = {
  name: 'Gnadlinger',
  memberIds: ['uid-1', 'uid-2'],
  kids: [{ id: 'kid-1', name: 'Anna' }, { id: 'kid-2', name: 'Lukas' }],
  customCategories: [{ id: 'cat-hobby', label: 'Hobby', color: 'pink' }],
  disabledBuiltins: [],
};

function mockFirestore({ token = {}, family = FAMILY } = {}) {
  getDocument.mockImplementation(async (path) => {
    if (path === `agentTokens/${TOKEN}`) {
      return {
        familyId: 'fam-1', userId: 'uid-1', revoked: false, locale: 'de', useCount: 4, ...token,
      };
    }
    if (path === 'families/fam-1') return family;
    if (path === 'users/uid-1') return { displayName: 'Johannes' };
    if (path === 'users/uid-2') return { displayName: 'Steffi' };
    return null;
  });
  createDocument.mockResolvedValue('new-doc-id');
  patchDocument.mockResolvedValue(undefined);
}

function mockRes() {
  const res = {
    statusCode: 0,
    body: null,
    headers: {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
    setHeader(key, value) {
      res.headers[key] = value;
      return res;
    },
    end(raw) {
      res.raw = raw;
      return res;
    },
  };
  return res;
}

const authed = (body, method = 'POST') => ({
  method,
  headers: { authorization: `Bearer ${TOKEN}` },
  body,
});

// A chatbot answering with one tool call, in the OpenAI dialect.
function stubProvider(toolCalls, reply = '') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: reply, tool_calls: toolCalls } }],
      }),
    })),
  );
}

const ENV_KEYS = [
  'FIREBASE_SERVICE_ACCOUNT',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'ANTHROPIC_API_KEY',
  'ASSISTANT_PROVIDER',
  'ASSISTANT_BASE_URL',
  'ASSISTANT_MODEL',
];
let saved;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const key of ENV_KEYS) delete process.env[key];
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
    client_email: 'a@b.iam.gserviceaccount.com',
    private_key: 'x',
    project_id: 'faos-test',
  });
  process.env.OPENAI_API_KEY = 'sk-test';
  vi.clearAllMocks();
  mockFirestore();
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.unstubAllGlobals();
});

describe('pairing tokens', () => {
  it('accepts the token from a header, a custom header or the query string', () => {
    expect(tokenFrom({ headers: { authorization: `Bearer ${TOKEN}` } })).toBe(TOKEN);
    expect(tokenFrom({ headers: { 'x-faos-token': TOKEN } })).toBe(TOKEN);
    expect(tokenFrom({ headers: {}, query: { token: TOKEN } })).toBe(TOKEN);
    expect(tokenFrom({ headers: {} })).toBe('');
  });

  it('refuses a malformed token before it reaches a document path', async () => {
    await expect(resolvePairing('../../families/fam-1')).rejects.toThrow(PairingError);
    expect(getDocument).not.toHaveBeenCalled();
  });

  it('refuses unknown and revoked tokens', async () => {
    await expect(resolvePairing('unknown_TOKEN12345')).rejects.toThrow(/Unknown pairing token/);
    mockFirestore({ token: { revoked: true } });
    await expect(resolvePairing(TOKEN)).rejects.toThrow(/revoked/);
  });
});

describe('POST /api/agent', () => {
  it('turns a sentence into an event and answers in the token\'s language', async () => {
    stubProvider([
      {
        function: {
          name: 'create_event',
          arguments: JSON.stringify({
            title: 'Friseur Carlo',
            date: '2026-09-25',
            time: '16:00',
            kids: ['Anna'],
            category: 'Hobby',
          }),
        },
      },
    ]);
    const res = mockRes();
    await agentHandler(authed({ text: 'Friseur Carlo am Freitag um 16:00' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.created).toEqual([
      { type: 'create_event', id: 'new-doc-id', summary: expect.stringContaining('Friseur Carlo') },
    ]);
    expect(res.body.reply).toMatch(/eingetragen/); // token locale is 'de'

    const [collection, document] = createDocument.mock.calls[0];
    expect(collection).toBe('events');
    expect(document).toMatchObject({
      familyId: 'fam-1',
      userId: 'uid-1',
      title: 'Friseur Carlo',
      category: 'cat-hobby',
      kids: ['kid-1'],
      // Nobody was named, so it lands on the member whose token this is.
      responsibleParent: 'Johannes',
      effortLevel: '',
      location: '',
    });
    expect(document.date).toEqual(new Date(2026, 8, 25, 16, 0));
    expect(document.createdAt).toBeInstanceOf(Date);
    expect(patchDocument).toHaveBeenCalledWith(`agentTokens/${TOKEN}`, {
      lastUsedAt: expect.any(Date),
      // Counts up from whatever the document already held.
      useCount: 5,
    });
  });

  // The endpoint writes with a service account, so rules do not protect the
  // family boundary here -- this does.
  it('ignores a familyId or userId sent by the caller', async () => {
    stubProvider([
      { function: { name: 'add_shopping_item', arguments: '{"title":"Milch","quantity":"2 l"}' } },
    ]);
    const res = mockRes();
    await agentHandler(
      authed({ text: 'Milch auf die Liste', familyId: 'other-family', userId: 'someone-else' }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(createDocument.mock.calls[0][1]).toMatchObject({
      familyId: 'fam-1',
      userId: 'uid-1',
      title: 'Milch',
      quantity: '2 l',
      done: false,
    });
  });

  it('says what it could not do instead of writing something wrong', async () => {
    stubProvider([], 'Für wann soll der Termin sein?');
    const res = mockRes();
    await agentHandler(authed({ text: 'Termin beim Friseur' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.created).toEqual([]);
    expect(res.body.reply).toBe('Für wann soll der Termin sein?');
    expect(createDocument).not.toHaveBeenCalled();
  });

  it('rejects a call with no usable token', async () => {
    const res = mockRes();
    await agentHandler({ method: 'POST', headers: {}, body: { text: 'x' } }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('unauthorized');
  });

  it('refuses to run without a service account, and says which variable', async () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    const res = mockRes();
    await agentHandler(authed({ text: 'x' }), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toContain('FIREBASE_SERVICE_ACCOUNT');
  });

  it('answers a configuration check without a token', async () => {
    const res = mockRes();
    await agentHandler({ method: 'GET', headers: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ configured: true, provider: 'openai', missing: [] });
  });
});

describe('POST /api/mcp', () => {
  const rpc = (method, params, id = 1) => authed({ jsonrpc: '2.0', id, method, params });

  it('completes the handshake and names itself', async () => {
    const res = mockRes();
    await mcpHandler(rpc('initialize', { protocolVersion: '2025-06-18' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.result).toMatchObject({
      protocolVersion: '2025-06-18',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'myfaos' },
    });
  });

  it('offers the three tools, carrying this family\'s own categories and children', async () => {
    const res = mockRes();
    await mcpHandler(rpc('tools/list'), res);
    const tools = res.body.result.tools;
    expect(tools.map((t) => t.name)).toEqual([
      'create_event',
      'create_task',
      'add_shopping_item',
    ]);
    const event = tools[0].inputSchema;
    expect(event.properties.kids.items.enum).toEqual(['Anna', 'Lukas']);
    expect(event.properties.category.enum).toContain('cat-hobby');
    expect(event.properties.responsible.enum).toEqual(['Johannes', 'Steffi']);
    // Nothing that reads or deletes is exposed.
    expect(tools.some((t) => /list|read|delete|update/.test(t.name))).toBe(false);
  });

  it('creates an entry from a tool call and confirms in one sentence', async () => {
    // Nothing should leave this process except the (mocked) Firestore write:
    // MCP arguments are already structured, so no second model is involved.
    const network = vi.fn();
    vi.stubGlobal('fetch', network);
    const res = mockRes();
    await mcpHandler(
      rpc('tools/call', {
        name: 'create_event',
        arguments: { title: 'Friseur Carlo', date: '2026-09-25', time: '16:00' },
      }),
      res,
    );
    expect(res.body.result.isError).toBeUndefined();
    expect(res.body.result.content[0].text).toContain('Friseur Carlo');
    expect(createDocument.mock.calls[0][0]).toBe('events');
    expect(createDocument.mock.calls[0][1]).toMatchObject({ familyId: 'fam-1', userId: 'uid-1' });
    expect(network).not.toHaveBeenCalled();
  });

  it('tells the model how to fix bad arguments rather than inventing an entry', async () => {
    const res = mockRes();
    await mcpHandler(rpc('tools/call', { name: 'create_event', arguments: { title: 'Friseur' } }), res);
    expect(res.body.result.isError).toBe(true);
    expect(res.body.result.content[0].text).toMatch(/YYYY-MM-DD/);
    expect(createDocument).not.toHaveBeenCalled();
  });

  it('answers a notification with no body and an unknown method with an error', async () => {
    const notification = mockRes();
    await mcpHandler(authed({ jsonrpc: '2.0', method: 'notifications/initialized' }), notification);
    expect(notification.statusCode).toBe(202);

    const unknown = mockRes();
    await mcpHandler(rpc('tools/subscribe'), unknown);
    expect(unknown.body.error.code).toBe(-32601);
  });

  it('answers a client that only accepts text/event-stream with one SSE event', async () => {
    const res = mockRes();
    await mcpHandler(
      {
        method: 'POST',
        headers: { authorization: `Bearer ${TOKEN}`, accept: 'text/event-stream' },
        body: { jsonrpc: '2.0', id: 7, method: 'ping' },
      },
      res,
    );
    expect(res.headers['content-type']).toBe('text/event-stream');
    expect(res.raw).toBe('event: message\ndata: {"jsonrpc":"2.0","id":7,"result":{}}\n\n');
  });

  it('demands a pairing token with a 401, so a client can ask for one', async () => {
    const res = mockRes();
    await mcpHandler({ method: 'POST', headers: {}, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } }, res);
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/openapi', () => {
  it('describes the endpoint against the host it was fetched from', async () => {
    const res = mockRes();
    openApiHandler({ method: 'GET', headers: { host: 'myfaos.app' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.servers).toEqual([{ url: 'https://myfaos.app' }]);
    expect(res.body.paths['/api/agent'].post.operationId).toBe('createFromSentence');
    expect(res.body.components.securitySchemes.pairingToken.scheme).toBe('bearer');
  });
});
