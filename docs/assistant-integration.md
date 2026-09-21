# Voice input and chatbot integration

Two ways into myFAOS without typing:

**A. The app's own microphone** — open myFAOS, speak one sentence, confirm.
Implemented and self-contained: [Part A](#part-a--the-apps-own-microphone).

**B. From a chatbot or a phone shortcut** — say it to Gemini, ChatGPT, Claude
or Siri and the entry appears in myFAOS without the app being open.
Implemented as an MCP server plus a REST endpoint: [Part B](#part-b--from-a-chatbot-or-a-phone-shortcut).

Which front ends can actually reach it today — including why "Hey Google" is
the hardest one in Europe — is [Part C](#part-c--what-works-where).

---

# Part A — the app's own microphone

```
 ┌─────────────────────────── browser ────────────────────────────┐
 │  mic  ──►  Web Speech API  ──►  transcript (text)              │
 │            (browser's own recognizer, no audio leaves it)      │
 │                                     ▼                          │
 │                        POST /api/assistant                     │
 │                        Authorization: Bearer <Firebase ID token>│
 └─────────────────────────────────────┬──────────────────────────┘
                                       ▼
 ┌────────────────── Vercel function (api/assistant.js) ──────────┐
 │  verify ID token ─► build tool schema ─► call the chatbot      │
 │      (Gemini | OpenAI | Anthropic | any OpenAI-compatible)     │
 └─────────────────────────────────────┬──────────────────────────┘
                                       ▼
 ┌─────────────────────────── browser ────────────────────────────┐
 │  validate + clamp proposals   (src/utils/assistantPlan.js)     │
 │  show them for confirmation   (VoiceAssistantModal)            │
 │  write with the user's own credentials → Firestore rules apply │
 └────────────────────────────────────────────────────────────────┘
```

Three decisions carry this design:

**Speech recognition stays in the browser.** The Web Speech API is free, needs
no key, and no audio ever reaches our servers — only the text does. The price
is browser support (see [limits](#limits-and-known-gaps)); every screen
therefore also offers a text field, which runs the identical path.

**The model only ever proposes.** It is asked to answer with *function calls*
(`create_event`, `create_task`, `add_shopping_item`) rather than prose, and its
answer is re-validated against the family's real categories, children and
members before anything is shown. Nothing is written until the review sheet is
confirmed.

**Writes stay client-side.** The endpoint never touches Firestore, so it needs
no service-account key, and every document goes through the same service
functions the forms use — the Firestore rules and demo mode keep working
unchanged.

### Configuration

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
| `ASSISTANT_BASE_URL` | no | Different endpoint for the chosen dialect (Groq, OpenRouter, Azure, a local Ollama). |
| `ASSISTANT_ALLOW_ANONYMOUS` | no | `true` disables ID-token checking. **Local development only.** |

`Settings → Voice assistant` shows `Connected: gemini (gemini-2.5-flash)` once
it works, and names the missing variable when it does not.

One sentence costs roughly 1–2k input tokens, so a fraction of a cent with the
small default models. Put the real ceiling on the provider's own key (a spend
limit): the in-function rate limit is best-effort, because serverless instances
share no memory.

### Locally

`vite dev` normally does not serve `api/*` at all. `vite.config.js` contains a
small dev middleware that runs those handlers in-process with a Vercel-shaped
`req`/`res`, and loads non-`VITE_` variables from `.env`, so this is enough:

```bash
# .env
GEMINI_API_KEY=AIza...
FIREBASE_PROJECT_ID=my-faos-project
npm run dev
```

### What the chatbot is told

Deliberately thin — the sentence, plus what is needed to resolve it: today's
date, weekday, local time and time zone; the UI language; category ids and
labels; the **first names** of children and adults. Not sent: uids, email
addresses, existing events, anything from other families.
`sanitizeContext()` in `api/_assistant/schema.js` enforces the shape and caps
the sizes, so a manipulated client cannot use the context to stuff the prompt.

---

# Part B — from a chatbot or a phone shortcut

Here the app is not open and nobody can confirm anything, so the shape is
different: a **pairing token** identifies the family, and the entry is written
server-side straight away.

```
  "Erstelle Termin für Friseur Carlo am Freitag um 16:00"
                 │
     ┌───────────┴────────────┐
     ▼                        ▼
 chatbot that speaks MCP    anything that can POST
 (Gemini, ChatGPT,          (Siri Shortcut, Tasker,
  Claude, Gemini CLI)        n8n, curl)
     │  fills the arguments      │  sends the raw sentence
     │  itself — no second       │  — the configured chatbot
     │  model needed             │    parses it here
     ▼                            ▼
   POST /api/mcp              POST /api/agent
   Authorization: Bearer <pairing token>
                 │
                 ▼
   resolve token → familyId + userId   (agentTokens/{token})
   validate against that family        (src/utils/assistantPlan.js)
   write via the Firestore REST API    (service account)
                 │
                 ▼
   { "reply": "„Friseur Carlo\" am Fr., 25. September um 16:00 eingetragen." }
```

### Endpoints

| Endpoint | For | Auth |
| --- | --- | --- |
| `POST /api/mcp` | chatbots (MCP: Gemini Connected Apps, ChatGPT connectors, Claude, Gemini CLI) | `Authorization: Bearer <token>` or `?token=` |
| `POST /api/agent` | shortcuts, automations, webhooks, curl | same |
| `GET /api/openapi` | tools that want a schema (ChatGPT custom GPT Actions, n8n, Make) | — |
| `GET /api/agent` | configuration check | — |

`/api/mcp` exposes three tools — `create_event`, `create_task`,
`add_shopping_item` — with **this family's own categories, children and adults
baked into their JSON schemas**, so the chatbot picks `kids: ["Anna"]` from a
list rather than guessing. It offers nothing that reads, changes or deletes.

`/api/agent` takes the sentence verbatim and runs it through the same
interpretation Part A uses:

```bash
curl -X POST https://myfaos.app/api/agent \
  -H "Authorization: Bearer $FAOS_TOKEN" \
  -H "content-type: application/json" \
  -d '{"text":"Friseur Carlo am Freitag um 16:00","lang":"de"}'
```

`reply` is one short sentence meant to be read out loud, in the language the
pairing token was created with.

### Setup

1. **Service account.** Firebase console → Project settings → Service accounts
   → *Generate new private key*. Put the JSON (raw or base64) into
   `FIREBASE_SERVICE_ACCOUNT` on Vercel. Without it these two endpoints return
   503 and say so, because a caller from outside the browser has no Firebase
   session and the server has to do the writing.
2. **Pairing token.** In the app: `Settings → Voice shortcuts → Create pairing
   token`. Give it the name of the thing you are connecting ("Gemini on my
   phone"). Copy its URL with the button next to it.
3. **Paste it** into the front end — the recipes below.

A token carries no expiry; revoke it in the same screen and it stops working
immediately. "Last used" tells you whether your shortcut ever actually arrived.

### Recipes

**ChatGPT (connector).** Settings → Connectors → add a custom connector →
paste `https://myfaos.app/api/mcp?token=…`. Then, in voice mode: *"Add a
calendar entry in myFAOS: Friseur Carlo on Friday at 16:00."*

**ChatGPT (custom GPT action).** Create a GPT → Actions → *Import from URL* →
`https://myfaos.app/api/openapi` → Authentication: API key, type Bearer, paste
the token. Works in the mobile app including voice.

**Claude.** Settings → Connectors → Add custom connector → the same
`/api/mcp?token=…` URL.

**Gemini app (Connected Apps).** gemini.google.com → Settings → Connected Apps
→ *Add a custom app* → the `/api/mcp?token=…` URL. **Check
[Part C](#part-c--what-works-where) first: this is the one front end that is
not available in the EEA, Switzerland or the UK as of September 2026.**

**Gemini CLI / AI Studio.** In `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "myfaos": {
      "httpUrl": "https://myfaos.app/api/mcp",
      "headers": { "Authorization": "Bearer PASTE_TOKEN_HERE" }
    }
  }
}
```

**Siri Shortcut (iPhone, iPad, Mac, Watch).** Shortcuts app → new shortcut:

1. *Dictate Text* (language: German) →
2. *Get contents of URL* → `https://myfaos.app/api/agent`, method POST,
   headers `Authorization: Bearer …` and `content-type: application/json`,
   request body JSON with `text` = the *Dictated Text* variable →
3. *Get dictionary value* `reply` → *Speak text*.

Name it "FAOS" and it answers to *"Hey Siri, FAOS"*.

**Android without an app store.** Two paths, both using `/api/agent`:
*HTTP Shortcuts* or *Tasker* (a task with *Get Voice* → *HTTP Request*), each
of which exposes a home-screen shortcut that Assistant can launch by name
("Hey Google, öffne FAOS Termin").

**Home-screen shortcut, no tools at all.** myFAOS installs as a PWA and its
launcher icon carries a *Voice input* shortcut (long-press the icon) pointing
at `/dashboard?assistant=1`, which opens the app with the microphone already
listening. `"Hey Google, öffne myFAOS"` plus one tap gets you there too. Not as
slick as a native voice action, but it needs no setup, no token and no API key.

**n8n / Make / Zapier.** Any HTTP-request node against `/api/agent`, or import
`/api/openapi`.

### Security model

* A pairing token may **create an event, a task or a shopping item in exactly
  one family**. It cannot read, change or delete anything, because the
  endpoints offer no such operation.
* The token is the document id in `agentTokens` — 128 bits of CSPRNG, the same
  construction invite links use. `firestore.rules` lets family members mint,
  see and revoke their own family's tokens and nothing else.
* `familyId` and `userId` always come from the token's document. A `familyId`
  in the request body is ignored — there is a test for exactly that, because
  the service account bypasses `firestore.rules` and this is the only thing
  holding the family boundary.
* Rate limit per token, best-effort (see the note in Part A).
* Treat a token like a password: whoever holds it can add entries to your
  family. A token in a URL (`?token=…`) is convenient for clients that accept
  nothing else, but it also lands in proxy logs — prefer the header where the
  client allows it.

---

# Part C — what works where

The honest state of play, September 2026. Availability changes; the endpoints
above do not.

| Front end | Voice | Works in the EEA | How |
| --- | --- | --- | --- |
| **ChatGPT** connector or custom GPT action | yes (app voice mode) | **yes** | `/api/mcp` or `/api/openapi` |
| **Claude** custom connector | yes (app voice) | **yes** | `/api/mcp` |
| **Siri Shortcut** | yes, "Hey Siri" | **yes** | `/api/agent` |
| **Gemini CLI / AI Studio** | typed | yes | `/api/mcp` |
| **Gemini app** (Connected Apps / Spark) | yes | **no** — see below | `/api/mcp` |
| **"Hey Google" directly to Assistant/Gemini** | yes | **no self-serve path** | — |
| Android *Tasker* / *HTTP Shortcuts* + "Hey Google, öffne …" | yes, two steps | yes | `/api/agent` |
| PWA launcher shortcut → `?assistant=1` | in-app mic | yes | nothing to set up |
| Alexa custom skill (German, free-text slot) | yes, "Alexa, sage FAOS …" | yes | would need a small skill (not built) |
| n8n / Make / webhook | — | yes | `/api/agent` |

**Why "Hey Google, … in FAOS" cannot be wired up directly right now:**

1. Google shut down **Conversational Actions** — third-party apps for Assistant
   — in June 2023. There is no replacement a web app can register for.
2. **IFTTT's Google Assistant trigger** used to be the classic bridge, but
   Google deprecated the API that passed a *text ingredient* ("say a phrase
   with a text ingredient") to IFTTT. A fixed phrase can still fire an applet;
   the free text that carries "Friseur Carlo am Freitag um 16:00" cannot.
   ([IFTTT's own note](https://ifttt.com/explore/google-assistant-changes),
   [Google's deprecation thread](https://support.google.com/assistant/thread/175099237/deprecating-ifttt-api-that-allowed-google-assistant-to-pass-on-text-ingredients-to-ifttt))
3. **Google Home automations** have no outbound-HTTP action.
4. **Gemini's Connected Apps** — the modern, self-serve way to plug a custom
   MCP server into the Gemini app, which is exactly what this repo now
   provides — requires a personal Google account and is gated by region:
   Gemini Spark rolled out to 160+ countries but **excludes the EEA,
   Switzerland, the UK** and a handful of others, with custom MCP connections
   gated more narrowly still.
   ([rollout report](https://ppc.land/gemini-spark-blocks-eu-and-uk-users-as-google-adds-160-countries/),
   [Google's Connected Apps help](https://support.google.com/gemini/answer/17209137))
5. Gemini on **Android** can call *native* app functions (the AppFunctions
   API), which needs a real Android app — a different project from a PWA.

So: for an Austrian or German household today, **ChatGPT or Claude as the voice
front end** is the one-sentence-and-done path, a **Siri Shortcut** is the best
"Hey <wake word>" experience on Apple hardware, and on Android the launcher
shortcut into the app's own microphone is the friction-free one. The moment
Google opens Connected Apps in the EEA, pasting the `/api/mcp` URL is the whole
migration.

---

## Adding another action

The assistant can create events, tasks and shopping items. Trackers, meals,
gifts and vault documents are not wired up. Each addition is three small steps,
and it lands in Part A and Part B at once:

1. **`api/_assistant/schema.js`** — add a tool declaration (name, description,
   JSON-schema parameters) to `buildToolDeclarations()` and its name to
   `ACTION_NAMES`.
2. **`src/utils/assistantPlan.js`** — add a `normalize…()` branch in
   `normalizeAssistantActions()` plus a `planTo…Payload()`, and cover it in
   `tests/unit/assistantPlan.spec.js`. This is where "the model may not be
   trusted" is enforced.
3. **Two writers** — `runAction()` in `src/services/assistant.js` (in-app) and
   `WRITERS` in `api/_assistant/create.js` (server-side), plus the fields and
   icon in `PlanFields`.

Tracker entries are the natural next one: they need a spoken tracker name
resolved onto an existing tracker id, which is the only genuinely new piece.

## Files

| Path | Role |
| --- | --- |
| `api/assistant.js` | Part A: interpret a sentence for the signed-in app. |
| `api/agent.js` | Part B: interpret **and create**, for shortcuts and webhooks. |
| `api/mcp.js` | Part B: MCP server (JSON-RPC over Streamable HTTP). |
| `api/openapi.js` | OpenAPI 3.1 description of `/api/agent`. |
| `api/_assistant/schema.js` | The action catalogue: tool schemas, system prompt, context sanitising. |
| `api/_assistant/providers.js` | One adapter per chatbot API. |
| `api/_assistant/auth.js` | Firebase ID-token verification + the rate limiter. |
| `api/_assistant/pairing.js` | Pairing tokens: the credential for Part B. |
| `api/_assistant/googleAuth.js` | Service-account JWT → Google access token. |
| `api/_assistant/firestore.js` | The slice of the Firestore REST API used for writes. |
| `api/_assistant/family.js` | One family's children, adults and categories. |
| `api/_assistant/create.js` | Validated actions → Firestore documents. |
| `src/utils/assistantPlan.js` | Shared validation. Pure, unit-tested, used by both parts. |
| `src/hooks/useSpeechRecognition.js` | Web Speech API wrapper. |
| `src/services/assistant.js` | Part A client: interpret, then write as the user. |
| `src/services/agentTokens.js` | Mint, list and revoke pairing tokens. |
| `src/components/assistant/` | The sheet and its trigger button. |
| `src/components/settings/AssistantSection.jsx` | Is a chatbot connected? |
| `src/components/settings/VoiceShortcutSection.jsx` | Pairing-token management. |

Tests: `assistantPlan`, `assistantProviders`, `assistantEndpoint`,
`agentFirestore`, `agentEndpoints` under `tests/unit/`.

## Limits and known gaps

* **No confirmation step in Part B.** A chatbot writes straight into the
  family's calendar. The protection is validation, not review: clamped dates,
  ids matched against the real family, at most a handful of entries per call.
  A wrong entry is edited or deleted in the app like any other.
* **Browser support (Part A).** Chrome, Edge and Safari (iOS 14.5+, prefixed)
  ship the Web Speech API; Firefox does not. Chrome recognises in Google's
  cloud, Safari on-device where it can — the browser's arrangement with its
  vendor, not ours.
* **Demo mode** has neither assistant: there is no account to authenticate
  with and no backend to write to.
* **One sentence at a time.** Nothing here is a conversation: the model cannot
  ask a follow-up and get an answer. The endpoints are stateless by design, so
  adding history later is additive.
* **All-day events** do not exist in the data model, so an event without a
  spoken time gets 09:00.
* **MCP is served as JSON**, with a single SSE event for clients that only
  accept `text/event-stream`. No session ids, no server-initiated streams, no
  OAuth: authentication is the pairing token, which is what a family app needs
  and what every client tested here accepts.
