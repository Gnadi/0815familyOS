# myFAOS

Mobile-first web app that helps families coordinate schedules, tasks, and
child documentation. This repository contains the MVP build — a Shared
Calendar backed by Firebase plus static UI stubs for the other planned
modules (Document Vault, Gift Planner, Task Manager).

## Tech Stack

- **Frontend:** React 18 + Vite
- **Styling:** Tailwind CSS, Inter (Google Fonts)
- **Backend:** Firebase — Authentication (Email/Password + Google) and Firestore
- **Image storage:** Cloudinary env vars reserved for future features
- **Routing:** react-router-dom
- **Date math:** date-fns
- **Icons:** lucide-react

State is managed with React Context + hooks. No Redux, Zustand, or
other state libraries.

## Project Structure

```
src/
├── components/           Reusable UI split by feature area
│   ├── common/           Button, Input, Modal, Spinner, EmptyState
│   ├── layout/           AppShell, TopBar, BottomNav
│   ├── landing/          FeatureCard
│   ├── dashboard/        WeeklyPreview (live), WorkloadBalance, HealthAlerts, QuickAccess
│   └── calendar/         ViewToggle, WeekView, MonthView, EventCard, EventFormModal
├── context/              AuthContext (user + family + loading)
├── hooks/                useAuth, useEvents
├── lib/                  firebase.js (SDK init, persisted session)
├── pages/                One route per file
├── routes/               ProtectedRoute, FamilyGate
├── services/             auth, users, families, events, cloudinary
└── utils/                date helpers, invite-code generator
```

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create a Firebase project**
   - In the Firebase console, enable the **Email/Password** and **Google**
     sign-in providers (Authentication → Sign-in method).
   - Create a Firestore database (start in production mode).
   - Copy your web-app config into a new `.env` at the project root
     (see `.env.example` for keys).

3. **Deploy Firestore rules (recommended)**
   The included `firestore.rules` enforces per-family access control.
   ```bash
   firebase deploy --only firestore:rules
   ```
   Once the repository secrets are in place, merges to `main` do this
   automatically — see [Firestore rules & indexes](#firestore-rules--indexes).

4. **Cloudinary (optional)**
   `VITE_CLOUDINARY_*` env vars are reserved for future image-upload
   features (e.g. Document Vault). They can be left empty for the MVP.

5. **Run locally**
   ```bash
   npm run dev
   ```

6. **Production build**
   ```bash
   npm run build
   npm run preview
   ```

7. **Tests**
   ```bash
   npm test         # unit tests (tests/unit)
   npm run test:rules   # Firestore rules against the emulator (needs Java)
   npm run test:all
   ```

## Firestore rules & indexes

`firestore.rules` and `firestore.indexes.json` are deployed by GitHub Actions
(`.github/workflows/firebase-firestore.yml`) as soon as a change to either one
lands on `main` — i.e. on merge. Pull requests that touch them run the
validation job only, so broken rules are caught before the merge.

Two repository settings are required (Settings → Secrets and variables →
Actions):

| Name | Type | Value |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Secret | The complete JSON key of a Google Cloud service account for the Firebase project |
| `FIREBASE_PROJECT_ID` | Variable | The Firebase project id to deploy to |

The service account needs three roles:

| Role | Needed for |
| --- | --- |
| Firebase Rules Admin (`roles/firebaserules.admin`) | Publishing `firestore.rules` |
| Cloud Datastore Index Admin (`roles/datastore.indexAdmin`) | Creating and updating the indexes |
| Service Usage Consumer (`roles/serviceusage.serviceUsageConsumer`) | The CLI checks that `firestore.googleapis.com` is enabled before it deploys anything |

The last one is easy to miss: without it the deploy stops at `ensuring
required API firestore.googleapis.com is enabled` with `HTTP Error: 403,
Permission denied to get service`, before rules or indexes are touched. The
key generated in the Firebase console (Project settings → Service accounts)
does not carry it by default — add it under IAM & Admin → IAM in the Google
Cloud console.

Create the key under IAM & Admin → Service Accounts → Keys → Add key → JSON,
and paste the file's entire contents into the secret.

The deploy runs without `--force`: indexes are created and updated, but an
index that exists in Firebase and is missing from `firestore.indexes.json` is
only reported in the job log, never deleted. Removing an index stays a manual
step in the Firebase console.

## Dependency audit

`.github/workflows/npm-audit.yml` runs `npm audit` on every pull request, on
every push to `main`, and once a week on Mondays — the weekly run is what
catches advisories published after the last merge. It fails as soon as an
advisory of severity **high** or **critical** is open for a dependency in
`package-lock.json`. The run's job summary lists the packages
behind it: severity, whether the package ships to users or is only installed
for development, and whether a fix has been published.

To clear a failing run:

```bash
npm audit               # the full list, lower severities included
npm audit fix           # everything a compatible release fixes
npm audit fix --force   # the rest, with breaking upgrades — test the app afterwards
```

The threshold is `AUDIT_LEVEL` in the workflow; lower it to `moderate` or
`low` once everything above that is cleared. A one-off run at a different
level can be started under Actions → npm audit → Run workflow.

## Data Model

```
users/{uid}           { email, displayName, familyId | null, notificationPrefs?, createdAt }
families/{id}         { name, createdBy, memberIds[], encryptionKeyJwk,
                        activeInvites[], lastJoinToken?, createdAt }
invites/{token}       { familyId, familyName, createdBy, createdByName,
                        revoked, expiresAt, createdAt }   // doc id IS the token
events/{id}           { familyId, userId, title, description?, date, createdAt, updatedAt }
```

## Auth & Family Flow

1. Landing page → Sign up (email/password or Google).
2. New users land on **Family Setup**: create a family (which mints a first
   invite link) or join an existing one by pasting an invite link.
3. Once `users.familyId` is set, the user is routed into the app shell
   (Dashboard, Calendar, Tasks, Settings) with a bottom nav.
4. Sessions persist via `browserLocalPersistence`.
5. Returning visitors skip the landing page: once the app knows where a user
   belongs it stores a route hint in `localStorage` (`src/lib/authHint.js`),
   and a tiny inline script in `index.html` redirects `/` to `/dashboard` (or
   `/family-setup`) before the marketing markup is parsed. The hint holds no
   credentials — it only saves the wait for Firebase Auth to restore the
   session asynchronously; a stale one lands on `/login` and is cleared.

### Invitations

Invites live in their own collection and the **document id is the token** — a
128-bit `crypto.getRandomValues` value. The rules allow `get` on a known id but
deny `list`, so a token can be redeemed by whoever holds the link and cannot be
enumerated. `/families` is `get`-only for members and never listable, because
the family document holds `encryptionKeyJwk`, the AES key for the document
vault.

Invites expire (7 days by default) and can be revoked in Settings. There is no
use counter: enforcing "single use" would need an atomic increment in the same
transaction as the family update, across two collections, which security rules
cannot express.

Links are `/join/:token` and are handled by `src/pages/JoinPage.jsx`.

Invite links are made to be forwarded, so `/join/*` is served by its own static
shells (`dist/join.html` and `dist/join.de.html`, written by
`scripts/emit-app-shell.mjs` and wired up in `vercel.json`) carrying Open
Graph/Twitter tags and a 1200x630 card (`public/og-invite*.png`, regenerate with
`scripts/generate_invite_og_image.py`). WhatsApp, Signal, iMessage and friends
never run JS, so without those static tags a pasted invite previews as the bare
domain. A static card cannot localize itself either, hence one shell per UI
language, chosen on `Accept-Language`. The card names no family: it is rendered
by every chat the link travels through, while reading the invite itself still
requires signing in.

## Shared Calendar (the working module)

- Toggle between Week and Month views.
- Tap the `+` FAB to create an event; tap an event card to edit or delete it.
- Events are stored in Firestore scoped to the user's `familyId`, and
  streamed in real time via `onSnapshot`, so every family member sees
  changes instantly.

## Task Board (working module)

- Scrum-style board with three columns: Backlog, In Progress, Completed.
- Tasks carry a category, priority, story points, due date, assignees,
  and a progress percentage (shown when in progress).
- A sprint runs Monday–Sunday. The efficiency score is the ratio of
  completed points to total points for tasks due in the current sprint.
- A weekly capacity heatmap surfaces day-by-day load and the pro-tip
  banner suggests rebalancing when a day is overloaded.
- Tap the `+` FAB on `/tasks` to create a task; tap a card to edit or
  delete it. Persisted in Firestore via the same per-family snapshot
  pattern as events.

## Child Tracker (working module)

A deliberately shapeless logger at `/tracker`, for the recurring "when was the
last time…?" questions — when Anna last had her medicine, when Steffi last
threw up, whether Lukas has had his vitamin D today.

- A **tracker** is a definition (name, emoji, colour, children). An **entry**
  is one logged moment, with an optional number and note. They live in
  `trackers` and `trackerEntries`, so a tracker's history can grow without
  ever rewriting the definition.
- Three optional switches cover the range of uses: record a number (with a
  unit) for doses and temperatures, a times-per-day goal that puts a tick on
  the card once reached, and a minimum gap in hours that shows when the next
  dose is due.
- A tracker can belong to several children at once — each child keeps their
  own separate history under it.
- Tapping `+` on a card logs "now" in one tap, with a six-second undo;
  trackers that record a number open the entry sheet instead of logging blind.
- Presets (medicine, vitamin D, threw up, temperature, nappy, drinking,
  teeth) only pre-fill the form; every field stays editable.

The Dashboard carries an **Active Trackers** widget listing every
child/tracker pairing, ordered by what still needs doing: unmet daily goals
first, then anything on a cooldown, then whatever was logged most recently.
Rows log in one tap there too, and link through to the full page.

Date, status and ordering logic lives in `src/utils/tracker.js` and is covered
by `tests/unit/tracker.spec.js`.

### Quick Access and newly shipped shortcuts

Quick Access is stored in `localStorage`, so a shortcut added after a user last
touched that list would never appear for them — sanitizing only ever drops
unknown ids, it never adds new ones. That is why the Tracker shortcut was
invisible on existing installs.

A second key, `familyos:quickAccessSeen`, records the ids the user has already
been *offered*; anything in the catalogue missing from it is appended once.
A shortcut removed on purpose stays removed, because it is still in the seen
list. Installs predating that key fall back to `LEGACY_QUICK_ACCESS_IDS` —
the catalogue as it stood before the migration — so new entries are correctly
recognised as new. The logic is pure, in `src/utils/quickAccess.js`, and
covered by `tests/unit/quickAccess.spec.js`.

## Reminders (first version)

Settings → Reminders sends notifications for upcoming appointments (the
member's own and unassigned ones, or all, 10–120 minutes ahead; all-day ones at
08:00), the next possible dose of a tracker with a minimum gap, a daily tracker
goal still open at 18:00, the member's tasks due today and vaccinations due
today (both at 08:00).

- **Per device, per member.** Whether a device shows notifications is a
  switch stored in that browser (`familyos:notifications`); *what* to be
  reminded of is `notificationPrefs` on the user document, so it follows the
  member to every device.
- **Delivery is on the device for now.** `ReminderScheduler` (mounted in
  `AppShell` only while reminders are on) reads the data the app already
  streams and shows each reminder through the service worker. It therefore
  works while myFAOS is open or running in the background, not once the app
  is fully closed; that needs Web Push and a server-side sender, the planned
  next step. On iPhone and iPad, notifications need the app on the Home
  Screen (iOS 16.4+).
- **No repeats.** Each reminder has an id that changes only when its fact does
  (the event moved, a new dose was logged), and sent ids are remembered in
  `localStorage` until the reminder expires, shared across tabs.
- The rules live in `src/utils/reminders.js`, pure and covered by
  `tests/unit/reminders.spec.js`, so the server-side sender can reuse them.

## Out of scope (future work)

Per the MVP spec, these are intentionally **not** implemented:

- Gift Planner logic
- Document Vault uploads
- Push notifications with the app closed (reminders currently need the app
  open or in the background), and email delivery of invites (links work;
  email does not)
- AI features
- Payments

The Dashboard's `WorkloadBalance`, `HealthAlerts`, and `QuickAccess`
widgets are static placeholders and match the provided design.
