# myFAOS — Smart Shopping Concept

The shopping list learns what a family buys and cooks, and turns that into one
list per week the family can rely on: buy everything on it and there is no
second trip — apart from a small, explicit mid-week list for fresh food. Later
stages add supermarket offers (Aktionen) and tell the family where to shop.

This document records the decisions made while working the idea out, the data
model, and the stages. Stage 1 is implemented; the rest is the plan.

---

## 1. Goals

| Goal | What it means |
|------|---------------|
| **One look a week** | In weekly mode the family reviews one proposal before the shopping day and can trust it. |
| **No extra effort** | Nothing is typed in for the app's sake. Checking items off is the only input; the app learns from that. |
| **Learn the family** | Purchase rhythms, planned meals and household size drive the proposal — not generic averages. |
| **Buy on offer, never at the cost of running out** | An item that is about to run out is on the list whether or not it is on offer. Offers decide *where* and *whether to stock up*, not *whether to buy what is needed*. |
| **Private and open source** | The project stays non-commercial and open source. Family data never leaves Firestore; price lookups (stage 2) only ever send generic product names. |

## 2. Decisions

| Question | Decision |
|----------|----------|
| Commercial or private? | Private, non-profit, open source. Determines the price-data licence (see §7). |
| Perishables in weekly mode | A **second list**, "Zwischendurch" (in between), for fresh food bought mid-week. |
| Effort when checking off | **None beyond the tap.** No prices, no shops, no quantities typed in. |
| Shops | Supermarkets **and drugstores**; each family picks which shops are relevant to them (stage 2/3). |
| Order of work | Stage 1 first, so data accumulates while price-data access is being arranged. |

## 3. Learning without extra input

### Purchase log

Before this feature the list kept no history: checking an item off only set
`done`, and a later re-add cleared `completedAt`. Stage 1 records every
check-off as a purchase, per product, in `shoppingProducts`:

- **One document per product and family**, id `{familyId}_{normalized title}`.
  Reads are bounded by the number of distinct products a family buys, not by
  how long it has used the app.
- **Appended with `arrayUnion`**, so a check-off in a supermarket without
  signal queues offline like any other write. The array is capped (oldest
  entries dropped) — recent behaviour is what matters for a rhythm.
- **Written separately from the item.** Logging is auxiliary; a failed log
  write must never fail the check-off.
- **Undo-aware.** Re-opening an item within 15 minutes of checking it off is
  treated as a mis-tap and removes the purchase again.
- **Backfilled.** Items checked off before the log existed still carry their
  `completedAt`. It is recorded as a purchase at the moment it would otherwise
  be erased (when the item goes back on the list), which gives the first
  rhythm a head start. Seeded starter items are never counted.

### Rhythm (prediction)

Pure logic in `src/utils/consumption.js`, unit-tested:

1. Purchases within 12 hours of each other are one **trip** (two "Milch" tiles
   ticked in the same shop are one purchase).
2. From at least **3 trips**, the rhythm is the **median** of the last
   intervals. The median shrugs off a holiday gap that a mean would not.
3. If the intervals scatter too much (median absolute deviation above 60 % of
   the median), the product is **irregular** and never predicted — birthday
   candles are not a rhythm.
4. **Due** = last trip + rhythm.
5. **"Still have it"** (one tap on a suggestion) pushes the due date out by
   half a rhythm, at least two days.
6. A suggestion that is ignored for long (due date passed by more than a
   rhythm, at least a week) goes **dormant** instead of nagging forever — the
   family may simply have stopped buying it.

Units are deliberately not modelled, matching `src/utils/ingredients.js`:
the time between purchases already reflects how much the family uses.

**Purchases for planned meals build no rhythm.** An item that is on the list
only because a planned meal needs it is marked `forMeals`; its purchase is
logged as `planned` and ignored by the rhythm. A family does not eat the same
every week: three weeks of Bolognese must not make spaghetti "due" in a week
with no pasta planned. Recipe ingredients come from the meal plan, never from
past weeks.

### Feedback loop

- An item added by hand mid-week is a purchase earlier than predicted — the
  next rhythm is shorter. No separate "miss" signal needed.
- "Still have it" is an over-prediction signal.
- Per product, "never suggest" switches suggestions off entirely.

## 4. Household

`families/{id}.household`:

| Field | Meaning | Default |
|-------|---------|---------|
| `adults` | Adults who eat at home | number of family members |
| `shoppingMode` | `continuous` (one running list) or `weekly` | `continuous` |
| `shoppingDay` | Day of the big weekly shop, `Date#getDay()` (0 = Sunday) | `6` (Saturday) |

Children are already stored with birthdays, so their portion is derived from
age instead of asked for:

| Age | Portion |
|-----|---------|
| under 1 | 0 (eats separately) |
| 1–3 | 0.5 |
| 4–9 | 0.7 |
| 10–13 | 0.9 |
| 14+ | 1 |
| unknown birthday | 0.7 |

Recipes gain an optional `servings`. When planned meals are put on the list,
amounts are scaled by `household portions / servings` — counts round up
(you cannot buy 2.4 eggs), weights and volumes round to sensible steps, and
units that do not scale ("1 Prise") are left alone.

## 5. Modes

### Continuous (default)

One "to buy" list as before, plus **Due soon**: products whose rhythm says
they run out within two days. One tap adds them; "still have it" snoozes.

### Weekly

- The to-buy list splits into **Weekly shop** and **In between** (fresh).
- New items land in *In between* if they are fresh produce (bread, milk,
  fruit, salad, meat, fish — guessed from the product icon, overridable per
  product), otherwise in *Weekly shop*.
- **Until the shop** suggests what runs out before the shopping day. Adding
  one puts it on *In between* — it is needed before the weekly shop, whatever
  kind of product it is.
- A **weekly proposal** for the next shopping day, reviewed before anything
  is written (the same review-first pattern as "add week to shopping list"):
  - everything predicted to run out before the shop after this one,
  - every ingredient of the meals planned for that week, scaled,
  - deduplicated against what is already on the list.

  It never offers the same thing twice:
  - **Each planned meal once.** Confirming the proposal — or "add week to
    shopping list" in the meal plan — marks the week's meals as shopped
    (`mealPlanEntries.shopped`, remembered with the recipe, so changing the
    meal to another recipe makes it open again). Shopped meals are listed as
    such instead of being offered again.
  - **This trip's purchases once.** Items the proposal adds carry the trip
    (`proposedFor`). Once bought, they are not offered again for the same
    trip: the weekly shop bought enough for the week, even if milk's rhythm
    says it lasts three days.
  - **No planned meals, no recipe ingredients.** The proposal then says so and
    links to the week plan; with fewer than seven recipes it suggests adding
    more, since a week of dinners cannot be planned with variety from fewer.

## 6. Stages

| Stage | Content | Status |
|-------|---------|--------|
| **1 — Learn** | Household settings, purchase log, recipe servings & scaling, prediction, suggestions, weekly mode with fresh list and proposal | **implemented** |
| **2 — Offers** | Price provider behind our own serverless endpoint; generic → concrete product matching confirmed once per family ("our milk" / "any brand"); offer badges with price, shop and validity on the existing `offer` flag; stock-up suggestions for durable products on a real discount | planned |
| **3 — Where to shop** | Family picks its shops (supermarkets and drugstores) and the max shops per trip; the list is grouped by shop; estimated savings | planned |
| **4 — Ideas** | Suggest meals for unplanned days from the family's *own* recipes, varied (nothing cooked in the last weeks); "Chicken is on offer — you often cook chicken curry"; price alerts; dashboard widget; holiday mode | ideas |

### Where to shop (stage 3 algorithm)

A family realistically uses a handful of shops, so every combination of up to
*max shops per trip* is enumerated: each item goes to its cheapest shop within
the combination, each extra shop adds a fixed penalty, the cheapest total
wins. Exact, and trivially fast at this size.

## 7. Price data (stage 2)

Source: [preisrunter.at](https://preisrunter.at/) — Austrian supermarket and
drugstore prices, offers and price history.

Constraints from its [API page](https://preisrunter.at/api/) and terms:

- API key required, per project, granted on application.
- Free tiers are non-commercial: **Research/Non-Profit, 1,000 requests a
  month, visible attribution** ("Quelle: Preisrunter (preisrunter.at)"), or
  Personal, 200 requests for 1–5 products. Commercial use starts at €250 a
  month. As a private, open-source project myFAOS targets the non-profit tier.
- Caching is allowed and recommended; bulk downloads and mirroring are not.
- Endpoints are not publicly documented — to be designed once access is
  granted.

Consequences for the design:

- **Only a serverless function talks to the provider** (like
  `api/ics-fetch.js`), with the key in a server-side environment variable.
  The key never reaches the browser.
- **Queries are generic product names** ("Milch"), never anything about a
  family, and are **cached across all families** with a TTL that follows the
  offer week. One family's lookup serves every other family's.
- **A provider interface** with a fixture-backed implementation for demo mode
  and development, so the feature works without a key and the source can be
  swapped later.

## 8. Privacy

Purchase rhythms are personal data. They live in Firestore under the same
per-family rules as the shopping list, are included in the family data export,
and are never sent anywhere. Stage 2 adds only outbound lookups of generic
product names.
