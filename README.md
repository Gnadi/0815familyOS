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

## Data Model

```
users/{uid}           { email, displayName, familyId | null, createdAt }
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

## Out of scope (future work)

Per the MVP spec, these are intentionally **not** implemented:

- Gift Planner logic
- Document Vault uploads
- Notifications / email delivery of invites (links work; email does not)
- AI features
- Payments

The Dashboard's `WorkloadBalance`, `HealthAlerts`, and `QuickAccess`
widgets are static placeholders and match the provided design.
