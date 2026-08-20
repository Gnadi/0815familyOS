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

// The four shortcuts Quick Access shipped with before it became configurable.
export const DEFAULT_QUICK_ACCESS = ['vault', 'gifts', 'health', 'shopping'];
