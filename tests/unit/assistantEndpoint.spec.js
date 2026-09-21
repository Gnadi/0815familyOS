import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/assistant.js';
import { rateLimit } from '../../api/_assistant/auth.js';

// The endpoint spends money per call, so its guards -- configured? signed in?
// sane input? -- matter as much as the happy path.

function mockRes() {
  const res = {
    statusCode: 0,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

const post = (body, headers = {}) => ({ method: 'POST', headers, body });

const ENV_KEYS = [
  'ASSISTANT_PROVIDER',
  'ASSISTANT_MODEL',
  'ASSISTANT_BASE_URL',
  'ASSISTANT_ALLOW_ANONYMOUS',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_PROJECT_ID',
];

let saved;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.unstubAllGlobals();
});

describe('GET /api/assistant', () => {
  it('names every missing piece of configuration, and no secrets', async () => {
    const res = mockRes();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ configured: false, authRequired: true });
    expect(res.body.missing).toEqual(['GEMINI_API_KEY', 'FIREBASE_PROJECT_ID']);
    expect(JSON.stringify(res.body)).not.toContain('key');
  });

  it('reports ready once a key and a project are set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.FIREBASE_PROJECT_ID = 'faos-test';
    const res = mockRes();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.body).toMatchObject({ configured: true, provider: 'openai', missing: [] });
  });
});

describe('POST /api/assistant', () => {
  it('refuses to run unconfigured', async () => {
    const res = mockRes();
    await handler(post({ transcript: 'Zahnarzt morgen' }), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('not_configured');
  });

  // Without this the endpoint is an open invitation to spend the family's
  // provider quota.
  it('requires a verified caller by default', async () => {
    process.env.GEMINI_API_KEY = 'k';
    process.env.FIREBASE_PROJECT_ID = 'faos-test';
    const res = mockRes();
    await handler(post({ transcript: 'Zahnarzt morgen' }), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('unauthorized');
  });

  it('rejects a garbage bearer token', async () => {
    process.env.GEMINI_API_KEY = 'k';
    process.env.FIREBASE_PROJECT_ID = 'faos-test';
    const res = mockRes();
    await handler(post({ transcript: 'x' }, { authorization: 'Bearer not.a.token' }), res);
    expect(res.statusCode).toBe(401);
  });

  it('validates the transcript before paying for a request', async () => {
    process.env.GEMINI_API_KEY = 'k';
    process.env.ASSISTANT_ALLOW_ANONYMOUS = 'true';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const empty = mockRes();
    await handler(post({ transcript: '   ' }), empty);
    expect(empty.statusCode).toBe(400);

    const long = mockRes();
    await handler(post({ transcript: 'a'.repeat(5000) }), long);
    expect(long.statusCode).toBe(413);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hands back only actions the app implements', async () => {
    process.env.GEMINI_API_KEY = 'k';
    process.env.ASSISTANT_ALLOW_ANONYMOUS = 'true';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { functionCall: { name: 'create_event', args: { title: 'Zahnarzt', date: '2026-09-22' } } },
                  { functionCall: { name: 'drop_database', args: {} } },
                  { text: 'Erledigt.' },
                ],
              },
            },
          ],
        }),
      })),
    );

    const res = mockRes();
    await handler(post({ transcript: 'Zahnarzt morgen', context: { today: '2026-09-21' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.actions).toEqual([
      { type: 'create_event', args: { title: 'Zahnarzt', date: '2026-09-22' } },
    ]);
    expect(res.body.reply).toBe('Erledigt.');
  });

  it('passes a provider failure on in a form the app can show', async () => {
    process.env.OPENAI_API_KEY = 'k';
    process.env.ASSISTANT_ALLOW_ANONYMOUS = 'true';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Incorrect API key provided' } }),
      })),
    );
    const res = mockRes();
    await handler(post({ transcript: 'Zahnarzt morgen' }), res);
    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({ code: 'provider_error', error: 'Incorrect API key provided' });
  });

  it('answers anything but GET/POST with 405', async () => {
    const res = mockRes();
    await handler({ method: 'DELETE', headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });
});

describe('rateLimit', () => {
  it('lets a burst through and then holds the line', () => {
    const now = Date.now();
    const allowed = Array.from({ length: 31 }, () => rateLimit('uid-burst', now));
    expect(allowed.filter(Boolean)).toHaveLength(30);
    expect(allowed[30]).toBe(false);
  });

  it('forgets a caller once their window has passed', () => {
    const now = Date.now();
    for (let i = 0; i < 30; i += 1) rateLimit('uid-window', now);
    expect(rateLimit('uid-window', now)).toBe(false);
    expect(rateLimit('uid-window', now + 6 * 60 * 1000)).toBe(true);
  });
});
