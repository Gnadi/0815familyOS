import { Activity, Calendar, CheckCircle2, FileText, Gift, ShoppingBasket, Syringe, UtensilsCrossed } from 'lucide-react';

// Every destination that can appear in the Dashboard's Quick Access section.
// Which ones actually show (and their order) is a UI preference edited in
// Settings; see `quickAccess` in UIPreferencesContext.
export const QUICK_ACCESS_ENTRIES = [
  { id: 'vault',    icon: FileText,        labelKey: 'dashboard.qaDocumentVault', bg: 'bg-emerald-50', color: 'text-emerald-600', to: '/vault' },
  { id: 'gifts',    icon: Gift,            labelKey: 'dashboard.qaGiftPlanner',   bg: 'bg-violet-50',  color: 'text-violet-600',  to: '/gifts' },
  { id: 'health',   icon: Syringe,         labelKey: 'dashboard.qaHealthLedger',  bg: 'bg-red-50',     color: 'text-red-500',     to: '/health' },
  { id: 'tracker',  icon: Activity,        labelKey: 'dashboard.qaTracker',       bg: 'bg-rose-50',    color: 'text-rose-500',    to: '/tracker' },
  { id: 'shopping', icon: ShoppingBasket,  labelKey: 'dashboard.qaShoppingList',  bg: 'bg-amber-50',   color: 'text-amber-600',   to: '/shopping' },
  { id: 'calendar', icon: Calendar,        labelKey: 'dashboard.qaCalendar',      bg: 'bg-sky-50',     color: 'text-sky-600',     to: '/calendar' },
  { id: 'tasks',    icon: CheckCircle2,    labelKey: 'dashboard.qaTasks',         bg: 'bg-indigo-50',  color: 'text-indigo-600',  to: '/tasks' },
  { id: 'meals',    icon: UtensilsCrossed, labelKey: 'dashboard.qaMealPlanner',   bg: 'bg-orange-50',  color: 'text-orange-600',  to: '/meals' },
];

export const QUICK_ACCESS_IDS = QUICK_ACCESS_ENTRIES.map((e) => e.id);

// What a fresh install shows.
export const DEFAULT_QUICK_ACCESS = ['tracker', 'vault', 'gifts', 'health', 'shopping'];

// The catalogue as it stood before `familyos:quickAccessSeen` existed. An
// install predating that key has no record of what it was offered, so this
// stands in as its baseline and everything added since (starting with
// 'tracker') migrates in once. Never edit this list — append new shortcuts to
// QUICK_ACCESS_ENTRIES instead, and the seen key handles them from here on.
export const LEGACY_QUICK_ACCESS_IDS = [
  'vault',
  'gifts',
  'health',
  'shopping',
  'calendar',
  'tasks',
  'meals',
];
