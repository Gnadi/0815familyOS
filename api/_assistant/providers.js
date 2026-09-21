// One adapter per chatbot API, so the rest of the assistant never knows which
// one is plugged in. All three (Gemini, OpenAI/ChatGPT, Anthropic) expose the
// same primitive -- "here is a sentence and a list of functions, tell me which
// to call with which arguments" -- they just spell it differently.
//
// Adding a fourth provider means adding one entry to each of the three maps
// below. Anything that speaks the OpenAI chat-completions dialect (Groq,
// OpenRouter, Together, a local Ollama, Azure OpenAI) needs no code at all:
// set ASSISTANT_PROVIDER=openai and point ASSISTANT_BASE_URL at it.

export const PROVIDERS = ['gemini', 'openai', 'anthropic'];

// Sensible, cheap, fast defaults. Any of them can be overridden per
// deployment with ASSISTANT_MODEL.
const DEFAULT_MODELS = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5-20251001',
};

const DEFAULT_BASE_URLS = {
  gemini: 'https://generativelanguage.googleapis.com',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
};

// Accepted key names, in order. GOOGLE_API_KEY is accepted for Gemini because
// that is what the Google docs hand you.
const KEY_ENV_NAMES = {
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
};

function firstKey(env, provider) {
  for (const name of KEY_ENV_NAMES[provider]) {
    const value = (env[name] || '').trim();
    if (value) return { key: value, name };
  }
  return { key: '', name: KEY_ENV_NAMES[provider][0] };
}

// Which provider this deployment talks to: the explicit choice if it is one we
// know, otherwise whichever key happens to be configured.
export function resolveProviderConfig(env = process.env) {
  const requested = (env.ASSISTANT_PROVIDER || '').trim().toLowerCase();
  const detected = PROVIDERS.find((p) => firstKey(env, p).key);
  const provider = PROVIDERS.includes(requested) ? requested : detected || PROVIDERS[0];
  const { key, name } = firstKey(env, provider);
  const baseUrl = (env.ASSISTANT_BASE_URL || '').trim().replace(/\/+$/, '')
    || DEFAULT_BASE_URLS[provider];

  return {
    provider,
    model: (env.ASSISTANT_MODEL || '').trim() || DEFAULT_MODELS[provider],
    apiKey: key,
    baseUrl,
    configured: Boolean(key),
    // What a deployer has to set to make this work, named exactly as the env
    // var. Surfaced in the app's settings screen, never the value itself.
    missing: key ? [] : [name],
    // True when ASSISTANT_PROVIDER named something we do not have an adapter
    // for -- worth saying out loud rather than silently using another one.
    unknownProvider: Boolean(requested) && !PROVIDERS.includes(requested) ? requested : '',
  };
}

// Gemini takes an OpenAPI-flavoured schema: upper-case type names and only a
// known subset of keywords. Anything else (additionalProperties, default, ...)
// makes it reject the request.
const GEMINI_KEYS = ['description', 'enum', 'format', 'nullable'];
function toGeminiSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  if (typeof schema.type === 'string') out.type = schema.type.toUpperCase();
  for (const key of GEMINI_KEYS) {
    if (schema[key] !== undefined) out[key] = schema[key];
  }
  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([k, v]) => [k, toGeminiSchema(v)]),
    );
  }
  if (schema.items) out.items = toGeminiSchema(schema.items);
  if (Array.isArray(schema.required) && schema.required.length) out.required = schema.required;
  return out;
}

// The reasoning-tuned OpenAI models reject an explicit temperature. Everything
// else benefits from 0 here: date arithmetic should not be creative.
function openAiTemperature(model) {
  return /^(?:o\d|gpt-5)/i.test(model) ? {} : { temperature: 0 };
}

// Pure: turns a request into { url, init } for fetch(). Kept free of I/O so
// the wire format of every provider is unit-testable.
export function buildRequest({ provider, model, apiKey, baseUrl, systemPrompt, transcript, tools }) {
  const base = (baseUrl || DEFAULT_BASE_URLS[provider] || '').replace(/\/+$/, '');

  if (provider === 'gemini') {
    return {
      url: `${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      init: {
        method: 'POST',
        // Key in a header, not the query string, so it cannot end up in an
        // access log or an error message that quotes the URL.
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: transcript }] }],
          tools: [{ functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: toGeminiSchema(t.parameters),
          })) }],
          toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
          generationConfig: { temperature: 0 },
        }),
      },
    };
  }

  if (provider === 'anthropic') {
    return {
      url: `${base}/v1/messages`,
      init: {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          temperature: 0,
          system: systemPrompt,
          messages: [{ role: 'user', content: transcript }],
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters,
          })),
        }),
      },
    };
  }

  // openai and every OpenAI-compatible gateway
  return {
    url: `${base}/chat/completions`,
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript },
        ],
        tools: tools.map((t) => ({ type: 'function', function: t })),
        tool_choice: 'auto',
        ...openAiTemperature(model),
      }),
    },
  };
}

function safeJson(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

// Pure: normalises a provider response into { actions: [{ type, args }], reply }.
export function parseResponse(provider, json) {
  const actions = [];
  const replies = [];

  if (provider === 'gemini') {
    const parts = json?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part?.functionCall?.name) {
        actions.push({ type: part.functionCall.name, args: safeJson(part.functionCall.args) || {} });
      } else if (typeof part?.text === 'string' && part.text.trim()) {
        replies.push(part.text.trim());
      }
    }
  } else if (provider === 'anthropic') {
    for (const block of json?.content || []) {
      if (block?.type === 'tool_use' && block.name) {
        actions.push({ type: block.name, args: safeJson(block.input) || {} });
      } else if (block?.type === 'text' && block.text?.trim()) {
        replies.push(block.text.trim());
      }
    }
  } else {
    const message = json?.choices?.[0]?.message;
    for (const call of message?.tool_calls || []) {
      const name = call?.function?.name;
      if (name) actions.push({ type: name, args: safeJson(call.function.arguments) || {} });
    }
    if (typeof message?.content === 'string' && message.content.trim()) {
      replies.push(message.content.trim());
    }
  }

  return { actions, reply: replies.join(' ').slice(0, 400) };
}

// The provider's own complaint, trimmed, so a misconfigured key or an
// exhausted quota shows up in the app instead of a blank "it failed".
export function providerErrorMessage(json, status) {
  const message = json?.error?.message || json?.error?.status || json?.message;
  const text = typeof message === 'string' ? message.trim() : '';
  return text ? text.slice(0, 300) : `Provider responded with HTTP ${status}.`;
}
