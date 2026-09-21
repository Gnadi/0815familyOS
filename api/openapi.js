// The OpenAPI description of /api/agent.
//
// ChatGPT's custom GPT Actions, n8n, Make and most automation tools want a
// schema rather than prose; pointing them at https://<host>/api/openapi is
// the whole setup. Chatbots that speak MCP should use /api/mcp instead -- it
// carries this family's categories and children in its tool schemas.

function origin(req) {
  const proto = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host || 'localhost';
  return `${proto}://${host}`;
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  res.setHeader('cache-control', 'public, max-age=3600');
  res.status(200).json({
    openapi: '3.1.0',
    info: {
      title: 'myFAOS voice interface',
      description:
        'Turns one spoken or typed sentence into entries in a family\'s shared '
        + 'calendar, task board or shopping list.',
      version: '1.0.0',
    },
    servers: [{ url: origin(req) }],
    paths: {
      '/api/agent': {
        post: {
          operationId: 'createFromSentence',
          summary: 'Create calendar, task or shopping entries from a sentence',
          description:
            'Send exactly what the person said, in their own language, including '
            + 'any date and time ("Friseur Carlo am Freitag um 16:00"). The reply '
            + 'is one short sentence to read back to them.',
          security: [{ pairingToken: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['text'],
                  properties: {
                    text: {
                      type: 'string',
                      maxLength: 1200,
                      description: 'The sentence, verbatim.',
                    },
                    lang: {
                      type: 'string',
                      enum: ['de', 'en'],
                      description: 'Language for the spoken reply. Defaults to the pairing token\'s.',
                    },
                    timezone: {
                      type: 'string',
                      description: 'IANA time zone of the speaker, e.g. Europe/Vienna.',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'What was created, plus a sentence to say out loud.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      reply: { type: 'string' },
                      created: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            type: {
                              type: 'string',
                              enum: ['create_event', 'create_task', 'add_shopping_item'],
                            },
                            id: { type: 'string' },
                            summary: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Missing, unknown or revoked pairing token.' },
            429: { description: 'Too many requests for this pairing token.' },
            503: { description: 'The deployment has no chatbot or service account configured.' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        pairingToken: {
          type: 'http',
          scheme: 'bearer',
          description:
            'A pairing token from myFAOS: Settings -> Voice shortcuts. It may only '
            + 'create entries in the one family it was minted for.',
        },
      },
    },
  });
}
