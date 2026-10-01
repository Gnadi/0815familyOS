import {
  Activity,
  Calendar,
  CheckCircle2,
  FileText,
  Gift,
  Home,
  Settings,
  ShoppingBasket,
  Syringe,
  UtensilsCrossed,
} from 'lucide-react';

// Every destination that can sit in the bottom navigation. Which ones show
// (and their order) is a family setting edited in Settings → Navigation; see
// src/hooks/useNavLayout.js. `labelKey` points at a short nav.* label — the
// column is narrow, so these stay one word per locale.
export const BOTTOM_NAV_ENTRIES = [
  { id: 'home',     to: '/dashboard', labelKey: 'nav.home',     Icon: Home },
  { id: 'calendar', to: '/calendar',  labelKey: 'nav.schedule', Icon: Calendar },
  { id: 'meals',    to: '/meals',     labelKey: 'nav.meals',    Icon: UtensilsCrossed },
  { id: 'tasks',    to: '/tasks',     labelKey: 'nav.tasks',    Icon: CheckCircle2 },
  { id: 'gifts',    to: '/gifts',     labelKey: 'nav.gifts',    Icon: Gift },
  { id: 'settings', to: '/settings',  labelKey: 'nav.settings', Icon: Settings },
  { id: 'shopping', to: '/shopping',  labelKey: 'nav.shopping', Icon: ShoppingBasket },
  { id: 'vault',    to: '/vault',     labelKey: 'nav.vault',    Icon: FileText },
  { id: 'health',   to: '/health',    labelKey: 'nav.health',   Icon: Syringe },
  { id: 'tracker',  to: '/tracker',   labelKey: 'nav.tracker',  Icon: Activity },
];

export const BOTTOM_NAV_IDS = BOTTOM_NAV_ENTRIES.map((e) => e.id);

// The layout the bar had before it became configurable.
export const DEFAULT_BOTTOM_NAV = ['home', 'calendar', 'meals', 'tasks', 'gifts', 'settings'];

// Always in the bar (wherever the family puts them): Home is the way back to
// the dashboard and Settings the only way into the configuration itself.
export const BOTTOM_NAV_REQUIRED = ['home', 'settings'];

// Fewer than two tabs is not navigation; more than six no longer fits a phone
// width next to the Material "+" button.
export const BOTTOM_NAV_MIN = 2;
export const BOTTOM_NAV_MAX = 6;
