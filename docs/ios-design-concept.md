# myFAOS — iOS Design Concept

A concept and design system for giving myFAOS an authentic **iOS look &
feel**, offered as a **selectable "iOS" skin** alongside the existing Material
(Android-flavoured) design. This document describes the design language; the
companion implementation wires it into the app.

---

## 1. Why

myFAOS is a mobile-first web app (React + Vite + Tailwind). Its current
appearance is strongly **Material Design / Android**:

- A **floating action button (FAB)** in the centre of the bottom navigation —
  the single most iconic Material pattern.
- **Inter** typeface instead of the Apple system font.
- **Fully-rounded pill buttons** (`rounded-full`) with shadows and an
  `active:scale` "ripple" press.
- **Material elevation** everywhere (`shadow-sm/card/md/lg/xl`) and saturated
  brand colours.
- A **top app bar** with a logo tile + notification bell, rather than an iOS
  large-title navigation bar.

The goal is a coherent, native-feeling iOS experience grounded in Apple's
**Human Interface Guidelines** — *Clarity, Deference, Depth* — that the user can
switch on without losing the existing design.

---

## 2. Design principles

| Principle | What it means here |
|-----------|--------------------|
| **Clarity** | Content first. Legible system type, generous spacing, restrained colour. |
| **Deference** | Chrome recedes — translucent bars, hairlines instead of heavy shadows, no floating buttons competing with content. |
| **Depth** | Hierarchy through layered, translucent materials (blur) and smooth sheet transitions, not drop-shadow elevation. |

---

## 3. Design tokens

### Typography
The Apple **system font stack** renders SF Pro natively on Apple devices (and a
sensible system font elsewhere). SF Pro cannot be legally self-hosted as a
webfont, so the system stack is the correct web approach.

```
-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif
```

Subtle negative letter-spacing (`-0.01em`) mimics SF's optical tightening.

iOS text styles (reference scale):

| Style | Size / weight |
|-------|---------------|
| Large Title | 34 / bold |
| Title 1–3 | 28–20 / bold–semibold |
| Body | 17 / regular |
| Footnote | 13 |
| Caption | 12 |

### Colour
- **Tint**: iOS **systemBlue `#007AFF`** is the default accent (mapped onto the
  `--brand-*` variables for the blue theme). The other four brand themes remain
  selectable as accent tints.
- **Backgrounds**: `systemGroupedBackground` `#F2F2F7` (light); `#000000` /
  `#1C1C1E` / `#2C2C2E` grouped surfaces (dark).
- **Separators**: hairlines (`#C6C6C8`-ish) instead of borders + shadows.

### Form & elevation
- Continuous, softer corners — buttons & fields at ~`rounded-xl` (10–12px)
  rather than `rounded-full`.
- **Flat surfaces**: card-level shadows removed; depth reserved for floating
  overlays (sheets) and expressed via translucency/blur.

### Layout
- **Inset grouped lists**: rounded white containers, rows divided by inset
  hairlines, disclosure chevrons (`›`) on navigable rows.

---

## 4. Navigation model

| Aspect | Material (current) | iOS (this concept) |
|--------|--------------------|--------------------|
| Bottom bar | Tab bar **with centre FAB** | Flat, **translucent tab bar**, no FAB |
| Add action | Floating `+` button | `+` in the navigation bar (top-right) |
| Top bar | App bar w/ logo tile + bell | **Large-title** nav bar, translucent |
| Back | Circular arrow button | Chevron `‹` + "Back", tinted |
| Dialogs | Material bottom sheet | Sheet with **grabber handle** |

---

## 5. Component mapping (Material → iOS)

| Component | Material | iOS |
|-----------|----------|-----|
| Bottom nav | 6 tabs + floating `+` FAB | 6 flat tabs, translucent, no FAB |
| Add affordance | Centre FAB | `+` in nav bar |
| Top bar | Logo tile + inline title | Large title, blurred background |
| Button | `rounded-full`, shadow, `active:scale` | `rounded-xl`, flat fill, `active:opacity` |
| Secondary button | White + border | Light gray fill, tinted label |
| Input | Bordered + elevated | Filled inset field (gray → white on focus) |
| Modal | Bottom sheet | Sheet + grabber handle |
| Quick-access | Colored 2-col tiles | Inset grouped list with chevrons |
| Cards / lists | Elevated cards | Flat surfaces + hairline separators |
| Filter chips | Pill chips | Pill scroller (already iOS-appropriate) |
| Dashboard heading | In-body `<h1>` | Folded into the large nav title |

---

## 6. Skin-switch architecture

The iOS look is wired exactly like the existing dark mode, so it is fully
runtime-switchable and the Material skin is untouched (regression-safe).

1. **State** — `UIPreferencesContext` gains a `skin` preference
   (`'material' | 'ios'`, default `material`), persisted to
   `localStorage['familyos:skin']` and reflected as `data-skin="ios"` on
   `<html>`. Toggle lives in **Settings → Appearance → Design style**.

2. **CSS override layer** (`src/index.css`) — `[data-skin="ios"]` rules flip the
   whole app at once: system font, grouped background, flattened shadows,
   systemBlue tint, and a true-black iOS dark palette. Most screens restyle
   automatically through these attribute selectors.

3. **Skin-aware components** — pieces that differ *structurally* (and can't be
   restyled by CSS alone) branch on `skin` from `useUIPreferences()`:
   `BottomNav`, `TopBar`, `Modal`, `Button`, `Input`, plus screen touches
   (`DashboardPage` large title, `QuickAccess` grouped rows). Each keeps the
   Material branch identical to before. The FAB's action is published via
   `AddActionContext` so the iOS nav-bar `+` can trigger it.

### Files
- Foundation: `src/context/UIPreferencesContext.jsx`, `src/pages/SettingsPage.jsx`, `src/index.css`, `tailwind.config.js`
- Add-action plumbing: `src/context/AddActionContext.js`, `src/components/layout/AppShell.jsx`
- Primitives: `src/components/common/{Button,Modal,Input}.jsx`
- Navigation: `src/components/layout/{BottomNav,TopBar}.jsx`
- Screen touches: `src/pages/DashboardPage.jsx`, `src/components/dashboard/QuickAccess.jsx`

---

## 7. Trying it

1. `npm run dev`
2. **Settings → Appearance → Design style → iOS**
3. Walk the app in light and dark: flat translucent tab bar (no FAB), large
   titles, `+` in the nav bar opening the right add sheet per route, grabber
   sheets, grouped lists, system font.
4. Switch back to **Material** to confirm the original look is unchanged.
