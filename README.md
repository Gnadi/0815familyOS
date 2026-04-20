# Family OS

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

## Data Model

```
users/{uid}           { email, displayName, familyId | null, createdAt }
families/{id}         { name, inviteCode, createdBy, memberIds[], createdAt }
events/{id}           { familyId, userId, title, description?, date, createdAt, updatedAt }
```

## Auth & Family Flow

1. Landing page → Sign up (email/password or Google).
2. New users land on **Family Setup**: create a family (generates a
   6-character invite code) or join an existing one via code.
3. Once `users.familyId` is set, the user is routed into the app shell
   (Dashboard, Calendar, Tasks, Settings) with a bottom nav.
4. Sessions persist via `browserLocalPersistence`.

## Shared Calendar (the working module)

- Toggle between Week and Month views.
- Tap the `+` FAB to create an event; tap an event card to edit or delete it.
- Events are stored in Firestore scoped to the user's `familyId`, and
  streamed in real time via `onSnapshot`, so every family member sees
  changes instantly.

## Out of scope (future work)

Per the MVP spec, these are intentionally **not** implemented:

- Gift Planner logic
- Document Vault uploads
- Task Manager logic
- Notifications / email invites
- AI features
- Payments

The Dashboard's `WorkloadBalance`, `HealthAlerts`, and `QuickAccess`
widgets are static placeholders and match the provided design.
