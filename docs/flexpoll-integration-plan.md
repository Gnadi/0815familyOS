# myFAOS ⇄ FlexPoll integration — plan (myFAOS side)

Goal: **families create private polls from inside myFAOS, running on FlexPoll,
without anyone ever creating a FlexPoll account.**

Two hard requirements drive every decision below:

1. **Private is really private.** Not "unlisted". A poll created from myFAOS
   must be unreadable to anyone outside the family that owns it.
2. **No second account.** A myFAOS user never sees a FlexPoll sign-up, never
   picks a FlexPoll password, never links anything. The bridge is invisible.

The companion document lives in the FlexPoll repo at
`docs/faos-integration-plan.md`. Sections 1–3 below are the **shared contract**
and are duplicated verbatim in both repos — change them in both or not at all.
Section 4 onwards is myFAOS's own work list.

---

## 0. Where we are starting from

Facts established by reading both codebases (2026-08):

| | myFAOS (`0815familyOS`) | FlexPoll (`0815Poll`) |
|---|---|---|
| Stack | React 18 + JS, Vite 5 + `vite-react-ssg` | React 19 + TS, Vite 6 |
| Firebase SDK | v10 | v11 |
| Firebase project | its own | its own, **separate** |
| Hosting | Vercel, `api/*.js` functions | Vercel, `api/*.ts` functions |
| Server-side Firebase | none | Cloud Function (Admin SDK) |
| Rules tests | `tests/rules/rules.spec.js` + emulator | **none** |

The blocking finding on the FlexPoll side: **it has no private polls today.**
Its rules say `allow read: if true` for `/polls/{pollId}`, and `isPrivate` only
removes a poll from the Explore listing. A poll is "private" the way an
unlisted video is. That does not satisfy requirement 1, so FlexPoll's
visibility model is rebuilt (FP-1…FP-7) **before** any myFAOS data reaches it.
myFAOS work can be written in parallel but must not be enabled until then.

---

## 1. Shared contract — identity federation

### 1.1 The chosen mechanism

FlexPoll acts as a **relying party** for myFAOS's Firebase Auth. One new
FlexPoll endpoint trades a myFAOS ID token for a FlexPoll Firebase **custom
token**:

```
myFAOS client                      FlexPoll /api/faos/session         Google
─────────────                      ──────────────────────────         ──────
getIdToken()  ──────────────────►  verify JWT signature ───────────►  securetoken
                                   (x509 certs, cached)               public keys
                                   assert iss/aud == FAOS project
                                   assert exp/iat
                                          │
                                   admin.createCustomToken(
                                     `faos_${faosUid}`,
                                     { provider: 'faos', faosUid })
                                          │
              ◄─────────────────── { customToken, uid, expiresIn }
signInWithCustomToken(flexpollAuth, customToken)
              ─────────────────────────────────────────────────────►  FlexPoll
                                                                      Firebase Auth
```

From that point the myFAOS client talks to **FlexPoll's Firestore directly**
with a real, rule-enforceable identity. No poll-shaped REST API is needed, and
results stay realtime through `onSnapshot` — the same pattern `useEvents`
already uses.

Crucially the FlexPoll session lives in a **secondary Firebase app instance**
(`initializeApp(flexpollConfig, 'flexpoll')`). myFAOS's own auth state, its
`browserLocalPersistence` session and its IndexedDB cache are untouched.

### 1.2 Why this and not the alternatives

| Option | Verdict |
|---|---|
| **Custom-token federation (chosen)** | Invisible to the user, one endpoint, realtime, rules can express "family only". Needs a FlexPoll service account. |
| Full REST API on FlexPoll | Also needs a FlexPoll service account (the server still has to write Firestore), but adds ~8 endpoints, loses realtime, and re-implements pagination/auth per route. Rejected. |
| Merge both apps into one Firebase project | Simplest auth story, but a data migration of two live products plus a merged rules file. Out of proportion. Rejected. |
| GCIP / OIDC provider federation | The "official" answer, but requires upgrading FlexPoll to Identity Platform (billing tier) for one partner. Rejected for now; the custom-token path can migrate to it later without changing uids. |
| Iframe FlexPoll inside myFAOS | Needs `X-Frame-Options: DENY` removed from FlexPoll's `vercel.json`, fights third-party storage partitioning, and can't be styled or translated (myFAOS is en/de). Rejected. |

### 1.3 UID derivation — the load-bearing detail

```
flexpollUid = `faos_${faosUid}`
```

Deliberately **deterministic and computable client-side**. That is what lets a
poll's audience list include family members *who have never opened FlexPoll* —
the creator derives their FlexPoll uids straight from `family.memberIds` at
creation time. The uid is an identifier, not a secret: it is only ever
*assumed* by someone who presented a valid myFAOS ID token to the session
endpoint.

Impersonation is closed off because Firebase assigns random uids to
email/password and Google sign-ups; the `faos_` namespace can only be entered
through a custom token, and only `/api/faos/session` mints those.

### 1.4 What must NOT cross the boundary

FlexPoll's rules let any signed-in user read any `users/{uid}` document (it
backs its invite-by-email lookup). Therefore:

- **Never let a myFAOS user's email reach FlexPoll's `users` collection.**
  The federated profile carries `displayName`, `provider: 'faos'`, and nothing
  else, and it is written *server-side* by the session endpoint so the display
  name cannot be spoofed.
- No `familyId`, invite token, or `encryptionKeyJwk` is ever sent. A poll
  carries an opaque `externalFamilyId` only, used for grouping.
- myFAOS sends exactly: the question, the options, the duration, the audience
  uid list, and a display name.

### 1.5 Data-protection note

Poll questions, options and votes are stored in **FlexPoll's** Firebase project
in plaintext — FlexPoll has to count votes, so the AES-GCM family key that
protects the document vault (`src/utils/encryption.js`) is not applicable here.
This is a disclosure item for both privacy policies (FA-19 / FP-16), not a
blocker: both products share one operator.

---

## 2. Shared contract — the private-poll data model

New fields on FlexPoll's `polls/{pollId}`:

```ts
visibility?: 'public' | 'unlisted' | 'restricted'  // absent ⇒ 'unlisted' (legacy)
audienceUids?: string[]      // required when visibility === 'restricted'
origin?: 'flexpoll' | 'faos' // provenance
externalFamilyId?: string    // opaque myFAOS family id, restricted polls only
```

Semantics:

- `public` — listed in Explore, readable by anyone. (`isPrivate === false`)
- `unlisted` — FlexPoll's current behaviour: hidden from Explore, readable via
  direct link. Every existing poll is this, by omission. Nothing breaks.
- `restricted` — **readable, votable and listable only by a uid in
  `audienceUids`.** This is the only kind myFAOS creates. Always paired with
  `isPrivate: true`.

`audienceUids` is capped (suggest 50) so a restricted poll stays a family-sized
object and the array-contains index stays cheap.

Every myFAOS-created poll is therefore:

```js
{
  visibility: 'restricted',
  isPrivate: true,
  origin: 'faos',
  externalFamilyId: family.id,
  audienceUids: family.memberIds.map((uid) => `faos_${uid}`),
  createdBy: `faos_${user.uid}`,
  settings: { anonymous: false, duration, allowMultipleChoices },
  ...
}
```

`settings.anonymous: false` is a UI-level choice about showing names; the
identity is always carried so double-voting prevention works.

### 2.1 Rule shape (FlexPoll `firestore.rules`)

Written and tested in FP-3; reproduced here so the two sides can be diffed.

```
function vis(d)        { return d.get('visibility', 'unlisted'); }
function inAudience(d) { return request.auth != null
                                && request.auth.uid in d.get('audienceUids', []); }

match /polls/{pollId} {
  allow get, list: if vis(resource.data) != 'restricted' || inAudience(resource.data);

  allow create: if <existing createdBy checks>
    && ( request.resource.data.get('visibility','unlisted') != 'restricted'
         || ( request.auth.token.get('provider','') == 'faos'
              && request.resource.data.isPrivate == true
              && request.auth.uid in request.resource.data.audienceUids
              && request.resource.data.audienceUids.size() <= 50 ) );

  allow update: if (creator) || (active && audience-gated vote-count bump)
                             || (audience-gated expiry flip);
}
```

plus an audience check on `create` in `votes`, `schedule_votes`,
`ranking_votes` and `priority_votes`.

### 2.2 Index

`where('audienceUids','array-contains', uid).orderBy('createdAt','desc')`
needs a composite index in FlexPoll's project (FP-6).

### 2.3 Membership changes

`audienceUids` is a snapshot taken at creation. When someone joins or leaves a
family afterwards, the *poll creator's* client reconciles open polls (FA-9).
Leaving a family removes the ex-member from open polls; it does not
retroactively erase votes they already cast.

---

## 3. Shared contract — endpoint spec

```
POST https://<flexpoll-host>/api/faos/session
Authorization: Bearer <myFAOS Firebase ID token>
Content-Type: application/json
{ "displayName": "Anna" }          // optional; server falls back to the token's name

200 { "customToken": "...", "uid": "faos_abc123", "expiresIn": 3600 }
401 { "error": "invalid_token" }
403 { "error": "origin_not_allowed" }
429 { "error": "rate_limited" }
```

CORS is an env allowlist on the FlexPoll side, never `*` — myFAOS's production
and preview origins must be registered there (FP-12) or every call fails in the
browser.

---

## 4. myFAOS todo list

Ordered. Everything ships behind `VITE_FLEXPOLL_ENABLED` and stays off until
FlexPoll has deployed FP-1…FP-13.

### Phase A — the bridge

- [ ] **FA-1 — Config + env.** `.env.example` gains `VITE_FLEXPOLL_ENABLED`,
      `VITE_FLEXPOLL_API_URL`, and the six `VITE_FLEXPOLL_FIREBASE_*` values
      (FlexPoll's *public* web config — apiKey, authDomain, projectId,
      messagingSenderId, appId). Mirror `src/lib/firebase.js`'s
      `firebaseConfigured` pattern with a `flexpollConfigured` flag so a
      missing config degrades to "feature hidden", never to a crash.

- [ ] **FA-2 — `src/lib/flexpoll.js`.** Lazily creates the **secondary**
      Firebase app (`initializeApp(cfg, 'flexpoll')`) plus its `getAuth` /
      `getFirestore`. Rules to hold to, matching the care already taken in
      `src/lib/firebase.js`:
      - never initialise during SSR (`import.meta.env.SSR`) — the landing page
        is pre-rendered by `vite-react-ssg`;
      - never initialise on module import — only from an effect or handler, so
        the ~200 KB second SDK instance stays out of the landing-page chunk;
      - **no** `persistentLocalCache` on this instance (multi-tab managers on
        two apps in one page is a footgun; poll data is small and live);
      - `getAuth` in a try/catch, returning `null` on a bad key.

- [ ] **FA-3 — `src/services/flexpollAuth.js`.** `ensureFlexpollSession()`:
      returns the existing signed-in FlexPoll user if present; otherwise gets
      the myFAOS ID token (`auth.currentUser.getIdToken()`), POSTs it to
      `/api/faos/session`, and `signInWithCustomToken`s the result.
      Requirements:
      - single-flight (concurrent callers share one in-flight promise);
      - retry once on 401 with `getIdToken(true)` — a stale myFAOS token is the
        likeliest failure;
      - `flexpollUid(faosUid) => 'faos_' + faosUid`, exported and unit-tested;
      - **sign the FlexPoll app out whenever myFAOS signs out** — wire into
        `AuthContext`'s `signOut` and into the `onAuthStateChanged(null)`
        branch, next to `clearAuthHint()`. A stranded FlexPoll session on a
        shared family tablet is exactly the leak this feature must not create.

- [ ] **FA-4 — Demo-mode guard.** `isDemoMode()` must short-circuit *before*
      any network call, in `ensureFlexpollSession` and in every service in
      FA-5. The demo has no Firebase user and must never reach FlexPoll. Seed
      two fake polls into `src/services/demoStore.js` so `/polls` demos
      properly, following the `demoAdd`/`demoSubscribe` pattern.

### Phase B — data layer

- [ ] **FA-5 — `src/services/polls.js`.** The whole FlexPoll surface, one
      module, demo-aware like `services/events.js`:
      - `createFamilyPoll({ family, user, type, question, description, options, durationHours, allowMultipleChoices })`
        — builds the document per §2, writes to FlexPoll's `polls` collection.
      - `subscribeFamilyPolls(flexUid, cb, onError)` — `onSnapshot` over
        `where('audienceUids','array-contains', flexUid)`,
        `orderBy('createdAt','desc')`, `limit(50)`.
      - `subscribePoll(pollId, cb)` — for the detail view.
      - `castVote(pollId, optionIds)` / `castScheduleVote(pollId, slots)` —
        port the transaction from FlexPoll's `src/lib/firestore.ts` (read poll,
        bump `options[].votes` / `timeSlots[].votes` + `totalVotes`, then write
        the vote document). Keep the "already voted" pre-check.
      - `getMyVote(pollId, flexUid)`, `closePoll(pollId)`, `deletePoll(pollId)`.
      - `syncAudience(poll, family)` — see FA-9.
      Every function calls `ensureFlexpollSession()` first.

- [ ] **FA-6 — `src/hooks/usePolls.js`.** Follow the shared-feed pattern in
      `src/hooks/useEvents.js` (module-level `Map`, refcounted subscribers,
      `LINGER_MS` teardown) so the dashboard widget and `/polls` share one
      listener rather than opening two.

- [ ] **FA-7 — Vote-state hook.** `usePollVote(pollId)` resolving "has this
      member voted, and for what", so cards can render the right control
      without each one querying.

- [ ] **FA-8 — Error taxonomy.** Extend the `tagged(code, message)` convention
      from `services/families.js`: `flexpoll/unavailable`,
      `flexpoll/not-configured`, `flexpoll/session-failed`,
      `flexpoll/already-voted`, `flexpoll/poll-closed`. Map to i18n keys in the
      UI; never surface a raw Firebase error.

- [ ] **FA-9 — Audience reconciliation.** When `family.memberIds` changes, the
      creator's client updates `audienceUids` on its own still-open polls
      (FlexPoll rules let the creator edit their own poll). Trigger it from the
      `/polls` page mount, comparing the family snapshot against each poll's
      audience — cheap, no extra listener, and self-healing.

### Phase C — UI

- [ ] **FA-10 — `src/pages/PollsPage.jsx`.** List of the family's open polls,
      then closed ones. `EmptyState` when there are none. FAB opens the create
      modal, matching `/tasks` and `/calendar`.

- [ ] **FA-11 — Components** under `src/components/polls/`:
      `PollCard.jsx` (question, vote counts, who has voted, time left),
      `PollFormModal.jsx` (question, 2–10 options, duration, multi-choice
      toggle — mirroring `TaskFormModal`/`EventFormModal`),
      `PollResults.jsx` (bars + totals),
      `VoteControls.jsx`.
      **v1 poll types: `standard` (single + multi choice) and `schedule`.**
      They cover "what's for dinner" and "when are we going"; ranking,
      priority, location, image and custom polls are pure UI work that can
      follow, with no backend change.

- [ ] **FA-12 — Route + navigation.** `{ path: 'polls', lazy: ... }` inside the
      `ProtectedAppLayout` children in `src/routes.jsx` (lazy, so it stays out
      of the SSG pass). Add a `polls` entry to
      `src/constants/quickAccessEntries.js` — the `familyos:quickAccessSeen`
      migration will surface it on existing installs automatically; do **not**
      touch `LEGACY_QUICK_ACCESS_IDS`. Decide separately whether it earns a
      `BottomNav` slot or stays a Quick Access shortcut (recommendation: Quick
      Access only — the nav is full).

- [ ] **FA-13 — Dashboard widget.** "Open polls" card showing polls awaiting
      *this member's* vote, one-tap voting inline, in the style of
      `ActiveTrackers`. This is what makes the feature actually get used.

- [ ] **FA-14 — i18n.** New `polls` namespace in `src/i18n/locales/en.js` **and**
      `de.js` (en is the reference dictionary — every key must exist in both).
      Includes the FA-8 error strings and `_one`/`_other` plurals for vote
      counts.

### Phase D — hardening and launch

- [ ] **FA-15 — Offline behaviour.** myFAOS's own Firestore runs a persistent
      IndexedDB cache; the FlexPoll instance (per FA-2) does not. `/polls` must
      therefore render an explicit offline state rather than an empty list.
      Check it against the service worker registration in
      `src/utils/registerSW.js`.

- [ ] **FA-16 — Notifications.** myFAOS owns notifying its own family; FlexPoll
      does not push for restricted polls (FP-17). For v1 this means an in-app
      badge on the Quick Access tile and the dashboard widget. No email, no
      FCM — matches the existing "invites work, email does not" scope note in
      the README.

- [ ] **FA-17 — Unit tests** (`tests/unit/polls.spec.js`, vitest, no emulator):
      - `flexpollUid` derivation is stable and prefixed;
      - audience computation from `family.memberIds` includes every member and
        the creator, and is capped;
      - `syncAudience` produces the right add/remove diff on join and leave;
      - the poll document builder always sets `visibility: 'restricted'` and
        `isPrivate: true` — the regression guard for requirement 1;
      - demo mode never produces a fetch.

- [ ] **FA-18 — Session-exchange integration test.** A mocked-`fetch` test that
      `ensureFlexpollSession` single-flights, refreshes on 401 exactly once,
      and surfaces `flexpoll/session-failed` rather than throwing raw.

- [ ] **FA-19 — Privacy page + README.** `src/pages/PrivacyPage.jsx` gains a
      paragraph: poll content and votes are processed by FlexPoll, in a
      separate Firebase project, in plaintext, and are visible only to family
      members (§1.5). Update the README's Data Model and "Out of scope"
      sections. Both locales.

- [ ] **FA-20 — Family deletion / offboarding.** Decide what happens to a
      family's polls when the family is deleted or a member leaves for good.
      Pairs with FP-18's retention sweep; needs an answer before launch, not
      before code.

---

## 5. Rollout order

1. FlexPoll FP-1 → FP-7 (visibility model + rules + tests), rules deployed and
   verified against production.
2. FlexPoll FP-8 → FP-13 (federation endpoint), smoke-tested with a real myFAOS
   ID token.
3. myFAOS FA-1 → FA-14 behind `VITE_FLEXPOLL_ENABLED=false`. Dogfood with one
   family on a preview deploy.
4. FA-15 → FA-20 and FP-14 → FP-18, then flip the flag on.

Nothing in step 3 may be enabled before step 1 lands: until FP-3 is deployed,
every poll in FlexPoll is world-readable by ID, and a "private" family poll
would be a false promise.

## 6. Open questions for the owner

- **Poll types in v1** — recommendation `standard` + `schedule` only (FA-11).
- **Can a family poll ever be shared outside the family** (a grandparent with
  no myFAOS account)? Requirement 1 says no. If that changes, the model extends
  with per-poll invite tokens — the same doc-id-is-the-secret trick myFAOS
  already uses for `/invites` — rather than by loosening `restricted`.
- **Retention** — when a family is deleted, who deletes its FlexPoll polls?
