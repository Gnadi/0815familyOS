# myFAOS — Feature Brainstorm (September 2026)

A second round of feature ideas, based on a pass through the codebase and a look
at what comparable family apps ship in 2026.

## Where the app stands

Ten working modules: Calendar (with ICS import, subscriptions and search), Task
board, Meals and recipes (including cooking mode), Shopping list, Document Vault
(AES-encrypted on the client), Gift Planner, Health Ledger (vaccinations), Child
Tracker, invite links, and a demo mode. The app is bilingual (EN/DE),
installable as a PWA, and works offline.

Gaps found in the code:

| Gap | Where |
| --- | --- |
| **No notifications at all.** The PWA and the service worker exist, but nothing reminds anyone of anything. The tracker's "next dose due", vaccinations that come due, and task due dates only show when someone opens the app. | `public/sw.js`, `utils/tracker.js`, `HealthAlerts.jsx` |
| **The backup is incomplete.** `exportFamily` skips `recipes` and `mealPlanEntries`, and there is no restore. | `src/utils/exportFamily.js` |
| **Workload Balance only counts calendar events.** Completed tasks, tracker logs and cooking never count toward it. | `WorkloadBalance.jsx` |
| **A child is only a name and a birthday.** Health, tracker, documents and gifts all reference `kidId`, but no page brings them together. | `services/families.js` |
| **Children can't take part.** They exist as profiles only, so they have no view of their own and no chores. | — |

## What the market says

- **Maple shuts down on 31 Dec 2026** (acqui-hired by Wander). Its main feature
  was turning school emails into tasks and events, and its users are looking for
  a new home right now.
- Parents mostly ask for **simplicity (74%)** and **reminders that fit their
  habits (58%)**. Only about 11% of mothers use a task app; most rely on
  WhatsApp, paper or memory.
- Competitors charge for: reminders, meal planning, chore charts and rewards,
  wall displays (Skylight, $80/yr plus hardware), and location (FamilyWall).
- In DACH, the pitch that works is "German-language, EU-hosted, private". The
  client-side encryption in myFAOS and its open-source code are a real advantage
  here.

---

## Tier 1 — the most impact

### 1. Reminders and push notifications
The foundation for most of the ideas below.
- Web Push through the existing service worker and FCM, with a Vercel cron in
  `api/` that sends what is due.
- What gets sent: an event reminder before it starts, "Anna's next ibuprofen
  dose is possible from 14:30" (from the tracker's `minGapHours`), vaccinations
  and tasks that are due, and one optional **morning digest** instead of many
  single pings.
- Per-member settings, including quiet hours. On iOS, Web Push only works for
  the installed PWA, which gives the existing install prompt a real purpose.

### 2. "Paste anything" into the plan
Maple's key feature, adapted to myFAOS.
- Paste the text of a letter from the Kita or school, or a WhatsApp message, or
  take a photo of it. An `api/` endpoint backed by Claude extracts dates,
  deadlines and things to bring. The app then shows them as **suggested** events
  and tasks, which a parent confirms before anything is saved.
- This is opt-in and nothing is stored on the server. The README lists AI as out
  of scope, so this is a deliberate product decision.
- A cheap first version: parse the text on the device with regex for dates
  (`12.10.`, `Mo, 14. Okt`), with no AI at all.

### 3. The weekly family planning session
A guided flow of about ten minutes for Sunday evening, and a feature that ties
the existing modules together:
1. Next week's events that have no responsible parent: assign them.
2. The meal plan: fill any empty slots.
3. Generate the shopping list (this already exists in `WeekShoppingModal`).
4. Tasks due this week: rebalance them using the capacity heatmap.
5. Summary: "Balance this week: 55/45".

No competitor offers this as one flow.

### 4. A profile page for each child
One page at `/kids/:id` that collects everything already stored under `kidId`:
vaccinations, tracker history, documents and awards, and gifts. New fields to
add:
- Clothing and shoe sizes, with the date they were measured. The Gift Planner
  can use them ("size 110 was 8 months ago").
- Allergies, medication, paediatrician, health insurance number.
- **Emergency card**: one page with only the essentials, printable with jsPDF
  or shareable.

### 5. Sharing with the babysitter or grandparents
A read-only link that expires, built the same way as the invite tokens: a
random document ID, `get` without `list`. It shows today's schedule, the
emergency card, and tracker buttons so the babysitter can log "had a bottle at
15:00". It extends the "external cooks" idea from the meal planner.

---

## Tier 2 — deepen the existing modules

| Idea | Why it fits |
| --- | --- |
| **Check-up schedule**: the U1–U9/J1 check-ups (DE) or the Eltern-Kind-Pass visits (AT), generated from the child's birthday, plus the STIKO vaccination schedule as an optional template | The Health Ledger already has due dates and alerts. This fills it without typing. |
| **Expiry dates in the Vault**: passports, ID cards, insurance policies, notice periods for contracts | Children's passports expire all the time. It reuses the logic that raises `HealthAlerts`. |
| **School holidays and public holidays** as a built-in subscription per state (DE/AT) | Calendar subscriptions already exist. This only needs a list of feeds. |
| **Charts in the tracker**: a fever curve, doses per day, and a PDF export for the paediatrician | The data is already in `trackerEntries`, and jsPDF is already a dependency. |
| **Shareable gift wishlist**: grandparents can reserve an item, and the kids never see it | This prevents duplicate presents. It uses the same token pattern as the invites. |
| **Workload Balance 2.0**: counts completed task points, tracker logs and cooking. Also shows *domains* in the style of Fair Play ("Kita communication belongs to Jo") | The widget exists but only measures part of the work. This covers the invisible load as well. |
| **Reusable checklists**: packing lists for holidays, the start of the school year, a hospital bag | Families repeat these every year. The recurrence logic can be reused. |
| **Staples and pantry**: the shopping list learns how often you buy something and suggests it again. Recipes subtract what is already at home. | `defaultShoppingItems` and `ingredients.js` provide the basis. |
| **Activity feed**: "Since your last visit: Alex added 3 events and ticked off the pharmacy." | Makes the shared state visible. Real-time snapshots are already in place. |

## Tier 3 — larger bets

- **Kids mode and chores with rewards.** A simple view on a tablet, with no
  child accounts needed: today's chores as big buttons, stars, and a pocket
  money account that reuses `utils/money.js`. Skylight charts extra for this.
- **Wall display at `/display`.** An old tablet in the kitchen becomes a free
  Skylight: landscape layout, Wake Lock API, today, meals and chores.
- **Import from Maple, Cozi and FamCal.** Aimed at the Maple shutdown on 31 Dec
  2026: ICS import plus CSV for lists and recipes, and a landing page for people
  switching.
- **Encrypted family notes.** Wi-Fi password, door codes, Kita PINs, secured
  with the same AES key as the Vault.

## Quick wins (small, can start right away)

1. Add `recipes` and `mealPlanEntries` to `exportFamily`. **This is a bug:** the
   backup is currently incomplete.
2. Expiry dates on Vault documents, with an alert on the Dashboard.
3. School holidays as a one-tap subscription.
4. A temperature chart in `TrackerDetailModal`.

## Recommended order

1. **Quick win 1** (the backup bug).
2. **Notifications**, because Tier 1 items 2, 3 and 5 and most of Tier 2 are
   much more useful with them.
3. **The weekly planning session.** It is cheap to build, because every piece
   already exists.
4. **The child profile, emergency card and babysitter link.** This sets myFAOS
   apart in the "child documentation" space, which is its original focus.
5. **"Paste anything"**, while Maple users are looking for a replacement
   (by the end of 2026).

## Sources

- [Maple is shutting down (Dec 31, 2026)](https://getsense.ai/blog/posts/maple-is-shutting-down-alternative-2026)
- [Maple: email to tasks and events](https://www.growmaple.com/email)
- [Best family organizer apps 2026 — Homsy](https://gethomsy.com/blog/comparisons/best-family-organizer-apps-2026)
- [Best family calendar apps 2026 — NestBoard](https://mynestboard.com/blog/best-shared-family-calendar-apps)
- [Best apps for mental load 2026 — RemindHer](https://remindher.app/best-app-for-mental-load/)
- [Familienkalender-Apps 2026 im Vergleich — Mailfence](https://blog.mailfence.com/de/beste-familienkalender-app/)
- [Best family management apps 2026 — Tribe Family](https://mytribefamily.com/blog/best-family-management-apps-2026)
