// The contract between the app and whichever language model is plugged in:
// which actions the model may propose, what a proposal has to look like, and
// what the model is told about the family before it sees the sentence.
//
// This lives on the server because it is only ever needed to build the request
// to the provider. What comes back is re-validated client-side against the
// family's real data (src/utils/assistantPlan.js) -- the model's output is
// treated as a suggestion, never as trusted input.

export const MAX_TRANSCRIPT_CHARS = 1200;
export const MAX_ACTIONS = 8;

// Caps on the context the client sends. A family roster is a handful of names;
// anything beyond this is either a mistake or someone trying to stuff the
// prompt, and it costs tokens either way.
const MAX_OPTIONS = 40;
const MAX_NAMES = 24;
const MAX_LABEL_CHARS = 60;

export const ACTION_NAMES = ['create_event', 'create_task', 'add_shopping_item'];

const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

function text(value, max = MAX_LABEL_CHARS) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function isoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function clockTime(value) {
  return /^\d{2}:\d{2}$/.test(value) ? value : '';
}

// [{ id, label }] pairs (categories) -- ids are what the model must echo back,
// labels are what it matches the spoken words against.
function options(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o) => o && typeof o === 'object')
    .map((o) => ({ id: text(o.id, 40), label: text(o.label) }))
    .filter((o) => o.id)
    .slice(0, MAX_OPTIONS);
}

function names(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((n) => text(n, 40))
    .filter(Boolean)
    .slice(0, MAX_NAMES);
}

// Everything the model is allowed to know about the family. Deliberately thin:
// first names, category labels, the current date -- no ids from Firestore, no
// email addresses, no existing events.
export function sanitizeContext(raw) {
  const ctx = raw && typeof raw === 'object' ? raw : {};
  return {
    today: isoDate(ctx.today),
    nowTime: clockTime(ctx.nowTime),
    weekday: text(ctx.weekday, 20),
    timezone: text(ctx.timezone, 60),
    language: text(ctx.language, 20) || 'English',
    categories: options(ctx.categories),
    taskCategories: options(ctx.taskCategories),
    kids: names(ctx.kids),
    members: names(ctx.members),
  };
}

const str = (description) => ({ type: 'string', description });

// An enum property is only emitted when there is something to choose from:
// an empty `enum` is invalid JSON Schema and some providers reject the whole
// request over it.
function enumProp(values, description) {
  if (!values.length) return null;
  return { type: 'string', enum: values, description };
}

function withProps(base, extra) {
  const properties = { ...base.properties };
  for (const [key, value] of Object.entries(extra)) {
    if (value) properties[key] = value;
  }
  return { ...base, properties };
}

function eventTool(ctx) {
  const categoryIds = ctx.categories.map((c) => c.id);
  const categoryHint = ctx.categories.map((c) => `${c.id} (${c.label})`).join(', ');
  return {
    name: 'create_event',
    description:
      'Put something on the shared family calendar: anything that happens at a '
      + 'given day and usually a given time (appointments, pickups, birthdays, '
      + 'training, visits).',
    parameters: withProps(
      {
        type: 'object',
        properties: {
          title: str(
            'Short title, 2-5 words, in the user\'s language. Just the thing itself '
            + '("Dentist Anna", "Parents evening") -- never the date or time.',
          ),
          date: str('The day, as YYYY-MM-DD, already resolved against today\'s date.'),
          time: str('Start time as 24h HH:MM. Omit it when no time was said.'),
          endTime: str('End time as 24h HH:MM. Only when it was said or is obvious.'),
          location: str('Place, only if one was mentioned.'),
          description: str('Anything said that does not fit the fields above. Usually omit.'),
        },
        required: ['title', 'date'],
      },
      {
        category: enumProp(categoryIds, `Best matching category. One of: ${categoryHint}.`),
        kids: ctx.kids.length
          ? {
              type: 'array',
              items: { type: 'string', enum: ctx.kids },
              description:
                'The children this is about, by name. Only names from this list, '
                + 'and only when a child was actually named or clearly implied.',
            }
          : null,
        responsible: enumProp(
          ctx.members,
          'The adult who takes care of it, by name. Only when it was said.',
        ),
        recurrence: {
          type: 'object',
          description: 'Only for something that genuinely repeats ("every Tuesday").',
          properties: {
            freq: { type: 'string', enum: FREQUENCIES, description: 'How often it repeats.' },
            interval: {
              type: 'integer',
              description: 'Every N of that unit. 1 unless "every other/second" was said.',
            },
            until: str('Last day of the series as YYYY-MM-DD, if one was given.'),
          },
          required: ['freq'],
        },
      },
    ),
  };
}

function taskTool(ctx) {
  const categoryIds = ctx.taskCategories.map((c) => c.id);
  const categoryHint = ctx.taskCategories.map((c) => `${c.id} (${c.label})`).join(', ');
  return {
    name: 'create_task',
    description:
      'Add a to-do to the family task board: something that has to get done by '
      + 'some day but does not happen at a fixed clock time (paperwork, repairs, '
      + 'calls, errands).',
    parameters: withProps(
      {
        type: 'object',
        properties: {
          title: str('Short title in the user\'s language, without the date.'),
          dueDate: str('Day it should be done by, as YYYY-MM-DD. Omit if none was said.'),
          description: str('Extra detail that was said. Usually omit.'),
          points: {
            type: 'integer',
            description: 'Rough effort in story points (1, 2, 3, 5, 8). Omit unless stated.',
          },
        },
        required: ['title'],
      },
      {
        priority: enumProp(
          PRIORITIES,
          'How urgent it sounded. "normal" unless the wording says otherwise.',
        ),
        category: enumProp(categoryIds, `Best matching category. One of: ${categoryHint}.`),
        assignees: ctx.members.length
          ? {
              type: 'array',
              items: { type: 'string', enum: ctx.members },
              description: 'Who should do it, by name. Only when it was said.',
            }
          : null,
      },
    ),
  };
}

function shoppingTool() {
  return {
    name: 'add_shopping_item',
    description: 'Put a product on the shared shopping list. One call per product.',
    parameters: {
      type: 'object',
      properties: {
        title: str('The product, singular and lower-case-free ("Milk", "Nappies size 4").'),
        quantity: str('Amount as spoken ("2", "500 g", "a pack"). Omit when none was said.'),
      },
      required: ['title'],
    },
  };
}

// Provider-neutral tool declarations: { name, description, parameters }.
// providers.js reshapes them into each API's own format.
export function buildToolDeclarations(ctx) {
  return [eventTool(ctx), taskTool(ctx), shoppingTool()];
}

export function buildSystemPrompt(ctx) {
  const lines = [
    'You turn one spoken sentence into entries for myFAOS, a shared family '
      + 'organizer (calendar, task board, shopping list).',
    '',
    'Context:',
    `- Today is ${ctx.weekday || 'today'}, ${ctx.today || 'unknown date'}`
      + `${ctx.nowTime ? `, local time ${ctx.nowTime}` : ''}`
      + `${ctx.timezone ? ` (${ctx.timezone})` : ''}.`,
    `- The user speaks ${ctx.language}. Write every title and reply in that language.`,
  ];
  if (ctx.kids.length) lines.push(`- Children in this family: ${ctx.kids.join(', ')}.`);
  if (ctx.members.length) lines.push(`- Adults in this family: ${ctx.members.join(', ')}.`);
  lines.push(
    '',
    'Rules:',
    '- Answer only by calling functions. One call per thing to create; a '
      + 'sentence can hold several.',
    '- Resolve every relative date yourself ("tomorrow", "next Tuesday", "in '
      + 'three weeks") into YYYY-MM-DD against today\'s date above. A weekday '
      + 'without a qualifier means its next future occurrence; a bare time that '
      + 'has already passed today means tomorrow.',
    '- Something with a day and usually a clock time is a calendar event. '
      + 'Something to get done by a day is a task. A product is a shopping item.',
    '- Never invent a detail. If a field was not said and has no obvious value, '
      + 'leave it out rather than guessing.',
    '- The sentence comes from speech recognition, so it may be slightly '
      + 'misheard and unpunctuated. Map near-miss names onto the roster above '
      + 'when one is clearly meant, and ignore filler words.',
    '- If the sentence holds nothing to create, call no function and reply with '
      + 'one short question asking for what is missing.',
  );
  return lines.join('\n');
}
