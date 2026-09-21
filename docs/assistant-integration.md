# Connecting a chatbot (Gemini, ChatGPT, …) for voice input

Goal: say *"Zahnarzt für Anna am Dienstag um 15 Uhr"* into the app and have the
event land in the family calendar — plus tasks and shopping items from the same
sentence.

This document describes what is implemented, how to configure it, and which
other routes were considered (and when they would be the better choice).

---

## 1. What is implemented

```
 ┌─────────────────────────── browser ────────────────────────────┐
 │  mic  ──►  Web Speech API  ──►  transcript (text)              │
 │            (browser's own recognizer, no audio leaves it)      │
 │                                     │                          │
 │                                     ▼                          │
 │                        POST /api/assistant                     │
 │                        { transcript, context }                 │
 │                        Authorization: Bearer <Firebase ID token>│
 └─────────────────────────────────────┬──────────────────────────┘
                                       ▼
 ┌────────────────── Vercel function (api/assistant.js) ──────────┐
 │  verify ID token ─► build function/tool schema ─► call provider│
 │      (Gemini | OpenAI | Anthropic | any OpenAI-compatible)     │
 │  provider answers with function calls, not prose               │
 └─────────────────────────────────────┬──────────────────────────┘
                                       ▼
 ┌─────────────────────────── browser ────────────────────────────┐
 │  validate + clamp proposals   (src/utils/assistantPlan.js)     │
 │  show them for confirmation   (VoiceAssistantModal)            │
 │  write with the user's own credentials                         │
 │      createEvent / createTask / createShoppingItem             │
 └────────────────────────────────────────────────────────────────┘
```

Three decisions carry this design:

**Speech recognition stays in the browser.** The Web Speech API is free, needs
no key, and no audio ever reaches our servers — only the text does. The price
is browser support (see [limits](#7-limits-and-known-gaps)); every screen
therefore also offers a text field, which runs the identical path.

**The model only ever proposes.** It is asked to answer with *function calls*
(`create_event`, `create_task`, `add_shopping_item`) rather than prose, and its
answer is re-validated against the family's real categories, children and
members before anything is shown. Nothing is written until the review sheet is
confirmed: a misheard word in a shared family calendar is worse than one extra
tap.

**Writes stay client-side.** The endpoint never touches Firestore, so it needs
no service-account key, and every document still goes through the same service
functions the forms use — the Firestore rules and demo mode keep working
unchanged.

### Files

| Path | Role |
| --- | --- |
| `api/assistant.js` | The endpoint. `GET` = configuration status, `POST` = interpret a sentence. |
| `api/_assistant/schema.js` | Which actions exist, their JSON schema, the system prompt, context sanitising. |
| `api/_assistant/providers.js` | One adapter per chatbot API (request + response shape). |
| `api/_assistant/auth.js` | Firebase ID-token verification (RS256, no Admin SDK) and a burst brake. |
| `src/hooks/useSpeechRecognition.js` | Web Speech API wrapper, language-aware, with error states. |
| `src/utils/assistantPlan.js` | Validates/normalises proposals, then builds service payloads. Pure, unit-tested. |
| `src/services/assistant.js` | Calls the endpoint, then writes the confirmed plan. |
| `src/components/assistant/` | The sheet (`VoiceAssistantModal`) and its trigger button. |
| `src/components/settings/AssistantSection.jsx` | Shows whether a chatbot is connected. |

Tests: `tests/unit/assistantPlan.spec.js`, `tests/unit/assistantProviders.spec.js`,
`tests/unit/assistantEndpoint.spec.js`.

---

## 2. Configuration

Server-side variables only — **never** prefixed with `VITE_`, because Vite
inlines those into the client bundle for anyone to read.

| Variable | Required | Meaning |
| --- | --- | --- |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | one key is required | Google AI Studio key (Gemini) |
| `OPENAI_API_KEY` | " | OpenAI key (ChatGPT models) |
| `ANTHROPIC_API_KEY` | " | Anthropic key (Claude models) |
| `FIREBASE_PROJECT_ID` | yes | Project the ID tokens must belong to. Falls back to `VITE_FIREBASE_PROJECT_ID`. |
| `ASSISTANT_PROVIDER` | no | `gemini` \| `openai` \| `anthropic`. Default: whichever key is set. |
| `ASSISTANT_MODEL` | no | Overrides the default model (`gemini-2.5-flash`, `gpt-4o-mini`, `claude-haiku-4-5-20251001`). |
| `ASSISTANT_BASE_URL` | no | Different endpoint for the chosen dialect — see [other providers](#5-plugging-in-a-different-chatbot). |
| `ASSISTANT_ALLOW_ANONYMOUS` | no | `true` disables ID-token checking. **Local development only.** |

### Vercel

Project → Settings → Environment Variables → add the key(s) + `FIREBASE_PROJECT_ID`
→ redeploy. `Settings → Sprachassistent` in the app then shows
`Verbunden: gemini (gemini-2.5-flash)`; if not, it names exactly which variable
is missing.

### Locally

`vite dev` normally does not serve `api/*` at all. `vite.config.js` contains a
small dev middleware that runs those handlers in-process with a Vercel-shaped
`req`/`res`, and loads non-`VITE_` variables from `.env` into `process.env`, so
this is enough:

```bash
# .env
GEMINI_API_KEY=AIza...
FIREBASE_PROJECT_ID=my-faos-project
npm run dev
```

Signed in, the microphone works as in production. For a quick test without a
Firebase project, `ASSISTANT_ALLOW_ANONYMOUS=true` plus demo mode works too.

### Cost

One sentence is roughly 1–2k input tokens (schema + prompt + roster) and a
handful of output tokens. With the small default models that is a fraction of a
cent per sentence — a family's month of daily use stays in the low cents. The
hard ceiling belongs on the provider's own key (spend limit), because the
in-function rate limit is best-effort only: serverless instances share no
memory.

---

## 3. What the chatbot is told

Deliberately thin — the sentence, plus what is needed to resolve it:

* today's date, weekday, local time and time zone (so "next Tuesday" works),
* the UI language,
* category **ids and labels** (event + task),
* the **first names** of children and adults in this family.

Not sent: uids, email addresses, existing events, tasks, documents, anything
from other families. `sanitizeContext()` in `api/_assistant/schema.js` enforces
the shape and caps the sizes, so a manipulated client cannot use the context to
stuff the prompt.

The same summary is shown to the user under the microphone, because they are
the ones deciding whether that is acceptable.

---

## 4. Adding another action

The assistant can currently create events, tasks and shopping items. Trackers,
meals, gifts and vault documents are not wired up. Each addition is three small
steps:

1. **`api/_assistant/schema.js`** — add a tool declaration (name, description,
   JSON-schema parameters) to `buildToolDeclarations()` and its name to
   `ACTION_NAMES`.
2. **`src/utils/assistantPlan.js`** — add a `normalize…()` branch in
   `normalizeAssistantActions()` plus a `planTo…Payload()`, and cover it in
   `tests/unit/assistantPlan.spec.js`. This is where "the model may not be
   trusted" is enforced.
3. **`src/services/assistant.js`** + **`VoiceAssistantModal`** — call the
   existing service in `runAction()`, and give the new kind a label, an icon
   and its editable fields in `PlanFields`.

Tracker entries are the natural next one: they need a tracker + child lookup,
which is the only genuinely new piece (resolving a spoken tracker name onto an
existing tracker id).

---

## 5. Plugging in a different chatbot

**Anything speaking the OpenAI chat-completions dialect** needs no code:

```bash
ASSISTANT_PROVIDER=openai
ASSISTANT_BASE_URL=https://api.groq.com/openai/v1   # or OpenRouter, Together,
OPENAI_API_KEY=...                                  # Azure, a local Ollama, …
ASSISTANT_MODEL=llama-3.3-70b-versatile
```

A *self-hosted* model (Ollama on a home server) is the option that keeps family
data entirely in-house; quality of German date parsing drops with model size,
so test with your own phrasings before relying on it.

**A provider with its own dialect** needs one entry in each of the three maps
in `api/_assistant/providers.js` plus a branch in `buildRequest()` and
`parseResponse()` — roughly 30 lines, and `tests/unit/assistantProviders.spec.js`
shows what to assert. The rest of the app does not know which provider answered.

---

## 6. Routes not taken (and when they would win)

| Route | How it works | Why not now |
| --- | --- | --- |
| **ChatGPT / Gemini as the front end** — a Custom GPT with Actions, a Gemini extension, or an MCP server | The family talks to the chatbot's own app; it calls a public, authenticated myFAOS API | Needs a public REST API plus per-user OAuth, and every family member needs a paid ChatGPT/Gemini account. Worth revisiting once an API for third parties exists anyway — the action schema in `_assistant/schema.js` is already the contract it would expose. |
| **Siri Shortcut / Google Assistant / Alexa** | OS-level voice → a shortcut POSTs the transcript to the same endpoint | Very attractive on iOS ("Hey Siri, add to myFAOS"), and cheap to add *later*: the endpoint already accepts a plain transcript. Blocker is authentication — a Shortcut cannot hold a Firebase session, so it needs per-device API tokens, which is its own feature. |
| **WhatsApp / Telegram bot** | Family sends a voice note to a bot; a webhook transcribes it (e.g. Whisper) and creates the entries | The best answer to "without opening the app at all", and it fixes browsers without speech recognition. Costs a messaging-platform integration, a transcription bill, and a second authentication story (phone number → family). |
| **Cloud speech-to-text instead of the Web Speech API** | Record audio in the app, send it to Whisper/Google STT, then through the same pipeline | Would cover Firefox and give better accuracy on names, but audio (not just text) would leave the device, adds cost per second, and needs recording/upload handling. The current design leaves room for it: only `useSpeechRecognition` would change. |
| **No model at all — a rule-based parser** | Regexes for "am Dienstag um 15 Uhr" | Free and private, but German phrasing is endless; it would fail exactly where a family is in a hurry. It stays useful as a *fallback*, not as the main path. |

---

## 7. Limits and known gaps

* **Browser support.** The Web Speech API is present in Chrome, Edge and Safari
  (iOS 14.5+, prefixed); Firefox does not ship it. There the sheet shows a note
  and the text field, which reaches the identical pipeline. Chrome performs
  recognition in Google's cloud, Safari on-device where it can — that is the
  browser's arrangement with its vendor, not ours, and worth knowing before
  writing privacy copy.
* **Demo mode** cannot use the assistant: the endpoint requires a verified
  sign-in and the demo has no account to authenticate with. The sheet says so.
* **The rate limit is per warm instance**, not global. Treat the provider's own
  spend limit as the real ceiling.
* **One sentence at a time.** There is no conversation: the model cannot ask a
  follow-up and get an answer. If something is missing it says so and the
  sentence is repeated. A multi-turn version would need the transcript history
  in the request — the endpoint is stateless by design, so that is an additive
  change.
* **All-day events** do not exist in the data model, so an event without a
  spoken time gets 09:00 (visible and editable in the review sheet).
