# myFAOS

Mobile-first web app that helps families coordinate schedules, tasks, meals,
shopping, documents, health records and gifts. Nine modules, all of them
backed by Firestore — there are no stub screens left. Two runtime design
skins (Material and iOS), five colour themes, dark mode, English and
German, an installable PWA, and a fully offline demo mode that needs no
account.

## Tech Stack

- **Frontend:** React 18 + Vite
- **Styling:** Tailwind CSS, Inter (Google Fonts)
- **Backend:** Firebase — Authentication (Email/Password + Google) and Firestore
- **File storage:** Cloudinary, for the Document Vault. Files are AES-256-GCM
  encrypted in the browser before upload; the key lives on the family document
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

4. **Cloudinary (needed for the Document Vault)**
   `VITE_CLOUDINARY_CLOUD_NAME` on the client, plus `CLOUDINARY_API_KEY` and
   `CLOUDINARY_API_SECRET` server-side for `api/cloudinary-sign.js` and
   `api/cloudinary-destroy.js`. Deleting a vault file also needs
   `FIREBASE_WEB_API_KEY` and `FIREBASE_PROJECT_ID`, because the destroy
   endpoint authorises the caller before removing anything.

   Leave them empty and the app runs — the vault simply saves entries without
   their attachments and says so.

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
events/{id}           { familyId, userId, title, description?, date, category,
                        kids[], responsibleParent, effortLevel, recurrence?,
                        source?: 'import'|'subscription', externalId?,
                        subscriptionId?, createdAt, updatedAt }
tasks/{id}            { familyId, userId, title, status, priority, storyPoints,
                        progress, assignees[], recurrence?, dueDate }
gifts/{id}            { familyId, userId, recipientId, title, price, ... }
documents/{id}        { familyId, userId, type: 'document'|'trophy', title,
                        category, fileUrl?, filePublicId?, fileName?, awardedTo? }
shoppingItems/{id}    { familyId, userId, title, done, quantity, icon, urgent,
                        offer, ifConvenient }
recipes/{id}          { familyId, userId, title, ingredients[], steps[], link? }
mealPlanEntries/{id}  { familyId, userId, date, slot, recipeId, cook }
vaccinations/{id}     { familyId, kidId, name, date,
                        status: 'done'|'next_up'|'pending' }
```

Sub-entities that live as arrays *inside* the family document rather than as
collections of their own: `kids`, `cooks`, `giftRecipients`,
`calendarSubscriptions`, `customCategories`, `disabledBuiltins`,
`customDocCategories`, `customTrophyCategories`.

There is no `firestore.indexes.json` beyond the one composite index the
calendar sync needs (`events` on `familyId` + `subscriptionId`); every other
query is single-field.

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

## Out of scope (future work)

- **Push notifications.** Reminders appear in-app (a bell in the top bar, fed
  by `useReminders`) and, while a tab is open, as an OS notification through
  the service worker. Real push needs a Cloud Function to send it, which needs
  the Blaze plan — and the only trigger available here is a client that is
  already open, at which point push was unnecessary.
- **Scheduled jobs.** There is no cron and no Cloud Function. Calendar
  subscriptions re-sync when someone opens the app, at most once an hour per
  family, coordinated by a lease on the family document. A family that nobody
  opens for a week does not sync for a week.
- **Email delivery of invites.** Invite links work; nothing sends them for you.
- **A full role model.** There is an owner (`createdBy`) who alone may remove
  members, and the vault key cannot be replaced once set. Beyond that every
  member has equal rights over the family's data.
- **AI features, payments.**
