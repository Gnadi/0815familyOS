import { describe, expect, it } from 'vitest';
import {
  buildRequest,
  parseResponse,
  providerErrorMessage,
  resolveProviderConfig,
} from '../../api/_assistant/providers.js';
import {
  ACTION_NAMES,
  buildSystemPrompt,
  buildToolDeclarations,
  sanitizeContext,
} from '../../api/_assistant/schema.js';

const CONTEXT = sanitizeContext({
  today: '2026-09-21',
  nowTime: '08:30',
  weekday: 'Monday',
  timezone: 'Europe/Vienna',
  language: 'German',
  categories: [{ id: 'health', label: 'Gesundheit' }],
  taskCategories: [{ id: 'urgent', label: 'Dringend' }],
  kids: ['Anna'],
  members: ['Johannes'],
});

const TOOLS = buildToolDeclarations(CONTEXT);

const request = (provider, extra = {}) =>
  buildRequest({
    provider,
    model: 'test-model',
    apiKey: 'secret-key',
    baseUrl: '',
    systemPrompt: 'system',
    transcript: 'Zahnarzt für Anna am Dienstag um 15 Uhr',
    tools: TOOLS,
    ...extra,
  });

describe('resolveProviderConfig', () => {
  it('detects the provider from whichever key is present', () => {
    expect(resolveProviderConfig({ OPENAI_API_KEY: 'k' })).toMatchObject({
      provider: 'openai',
      configured: true,
      missing: [],
    });
    expect(resolveProviderConfig({ GOOGLE_API_KEY: 'k' })).toMatchObject({
      provider: 'gemini',
      configured: true,
    });
  });

  it('honours an explicit choice and names the key it still needs', () => {
    const config = resolveProviderConfig({ ASSISTANT_PROVIDER: 'anthropic', OPENAI_API_KEY: 'k' });
    expect(config).toMatchObject({
      provider: 'anthropic',
      configured: false,
      missing: ['ANTHROPIC_API_KEY'],
    });
  });

  it('reports a provider it has no adapter for instead of silently swapping', () => {
    const config = resolveProviderConfig({ ASSISTANT_PROVIDER: 'mistral', GEMINI_API_KEY: 'k' });
    expect(config.unknownProvider).toBe('mistral');
    expect(config.provider).toBe('gemini');
  });

  // The whole point of ASSISTANT_BASE_URL: any OpenAI-compatible gateway
  // (Groq, OpenRouter, a local Ollama) without touching the code.
  it('routes an OpenAI-compatible gateway through the openai adapter', () => {
    const config = resolveProviderConfig({
      ASSISTANT_PROVIDER: 'openai',
      OPENAI_API_KEY: 'k',
      ASSISTANT_BASE_URL: 'https://api.groq.com/openai/v1/',
    });
    const { url } = buildRequest({ ...config, systemPrompt: 's', transcript: 't', tools: TOOLS });
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
  });
});

describe('buildRequest', () => {
  it('keeps the Gemini key in a header, never in the URL', () => {
    const { url, init } = request('gemini');
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent',
    );
    expect(url).not.toContain('secret-key');
    expect(init.headers['x-goog-api-key']).toBe('secret-key');
  });

  it('declares every action to every provider', () => {
    const gemini = JSON.parse(request('gemini').init.body);
    const openai = JSON.parse(request('openai').init.body);
    const anthropic = JSON.parse(request('anthropic').init.body);
    expect(gemini.tools[0].functionDeclarations.map((t) => t.name)).toEqual(ACTION_NAMES);
    expect(openai.tools.map((t) => t.function.name)).toEqual(ACTION_NAMES);
    expect(anthropic.tools.map((t) => t.name)).toEqual(ACTION_NAMES);
  });

  // Gemini rejects a request whose schema carries lower-case types or
  // keywords outside its OpenAPI subset.
  it('converts the schema to Gemini\'s dialect', () => {
    const body = JSON.parse(request('gemini').init.body);
    const event = body.tools[0].functionDeclarations[0];
    expect(event.parameters.type).toBe('OBJECT');
    expect(event.parameters.properties.title.type).toBe('STRING');
    expect(event.parameters.properties.kids.type).toBe('ARRAY');
    expect(event.parameters.properties.kids.items.enum).toEqual(['Anna']);
  });

  it('pins the temperature except on models that reject it', () => {
    expect(JSON.parse(request('openai').init.body).temperature).toBe(0);
    const reasoning = buildRequest({
      provider: 'openai',
      model: 'o4-mini',
      apiKey: 'k',
      systemPrompt: 's',
      transcript: 't',
      tools: TOOLS,
    });
    expect(JSON.parse(reasoning.init.body).temperature).toBeUndefined();
  });

  it('sends the Anthropic version header', () => {
    expect(request('anthropic').init.headers['anthropic-version']).toBe('2023-06-01');
  });
});

describe('parseResponse', () => {
  it('reads Gemini function calls and text', () => {
    expect(
      parseResponse('gemini', {
        candidates: [
          {
            content: {
              parts: [
                { functionCall: { name: 'create_event', args: { title: 'Zahnarzt' } } },
                { text: 'Alles klar.' },
              ],
            },
          },
        ],
      }),
    ).toEqual({ actions: [{ type: 'create_event', args: { title: 'Zahnarzt' } }], reply: 'Alles klar.' });
  });

  it('parses OpenAI tool-call arguments, which arrive as a JSON string', () => {
    const parsed = parseResponse('openai', {
      choices: [
        {
          message: {
            content: 'ok',
            tool_calls: [
              { function: { name: 'create_task', arguments: '{"title":"Pässe"}' } },
              { function: { name: 'create_task', arguments: 'not json' } },
            ],
          },
        },
      ],
    });
    expect(parsed.actions[0].args).toEqual({ title: 'Pässe' });
    // Unparsable arguments must not take the whole answer down.
    expect(parsed.actions[1].args).toEqual({});
  });

  it('reads Anthropic tool_use blocks', () => {
    expect(
      parseResponse('anthropic', {
        content: [
          { type: 'text', text: 'Klar.' },
          { type: 'tool_use', name: 'add_shopping_item', input: { title: 'Milch' } },
        ],
      }),
    ).toEqual({ actions: [{ type: 'add_shopping_item', args: { title: 'Milch' } }], reply: 'Klar.' });
  });

  it('returns nothing usable rather than throwing on an unexpected shape', () => {
    for (const provider of ['gemini', 'openai', 'anthropic']) {
      expect(parseResponse(provider, null)).toEqual({ actions: [], reply: '' });
      expect(parseResponse(provider, { unexpected: true })).toEqual({ actions: [], reply: '' });
    }
  });
});

describe('sanitizeContext', () => {
  it('drops anything the client should not be able to put in the prompt', () => {
    const ctx = sanitizeContext({
      today: 'not-a-date',
      nowTime: '99',
      categories: [{ id: '', label: 'x' }, 'nope', { id: 'ok', label: 'y' }],
      kids: Array.from({ length: 100 }, (_, i) => `Kid${i}`),
      members: null,
    });
    expect(ctx.today).toBe('');
    expect(ctx.nowTime).toBe('');
    expect(ctx.categories).toEqual([{ id: 'ok', label: 'y' }]);
    expect(ctx.kids).toHaveLength(24);
    expect(ctx.members).toEqual([]);
  });

  it('leaves an empty roster out of the schema instead of emitting an empty enum', () => {
    const tools = buildToolDeclarations(sanitizeContext({ today: '2026-09-21' }));
    const event = tools.find((t) => t.name === 'create_event');
    expect(event.parameters.properties.kids).toBeUndefined();
    expect(event.parameters.properties.responsible).toBeUndefined();
    expect(event.parameters.properties.category).toBeUndefined();
  });
});

describe('buildSystemPrompt', () => {
  it('states the date, the language and the roster the model must resolve against', () => {
    const prompt = buildSystemPrompt(CONTEXT);
    expect(prompt).toContain('2026-09-21');
    expect(prompt).toContain('German');
    expect(prompt).toContain('Anna');
    expect(prompt).toContain('Europe/Vienna');
  });
});

describe('providerErrorMessage', () => {
  it('passes the provider\'s own complaint through, trimmed', () => {
    expect(providerErrorMessage({ error: { message: 'API key not valid' } }, 400))
      .toBe('API key not valid');
    expect(providerErrorMessage(null, 503)).toBe('Provider responded with HTTP 503.');
  });
});
