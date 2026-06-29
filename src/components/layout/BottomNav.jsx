import { NavLink } from 'react-router-dom';
import { Calendar, CheckCircle2, Gift, Home, Plus, Settings, UtensilsCrossed } from 'lucide-react';
import useUIPreferences from '../../hooks/useUIPreferences';
import useT from '../../hooks/useT';

// Note: the Document Vault used to sit here; it now lives in the Dashboard's
// Quick Access since the Meal planner is reached far more often. `labelKey`
// points at a nav.* translation key resolved at render time.
const items = [
  { to: '/dashboard', labelKey: 'nav.home',     Icon: Home },
  { to: '/calendar',  labelKey: 'nav.schedule', Icon: Calendar },
  { to: '/meals',     labelKey: 'nav.meals',    Icon: UtensilsCrossed },
];
const itemsRight = [
  { to: '/tasks',    labelKey: 'nav.tasks',    Icon: CheckCircle2 },
  { to: '/gifts',    labelKey: 'nav.gifts',    Icon: Gift },
  { to: '/settings', labelKey: 'nav.settings', Icon: Settings },
];

function NavItem({ to, label, Icon, showLabels }) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className={({ isActive }) =>
        `flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-1 py-2 text-xs ${
          isActive ? 'text-brand-600' : 'text-slate-500'
        }`
      }
    >
      <Icon size={showLabels ? 22 : 26} />
      {showLabels && <span className="font-medium">{label}</span>}
    </NavLink>
  );
}

// iOS tab bar: flat, translucent, no floating action button. All sections sit
// side by side with a small icon over a tiny label, active item picks up the
// brand tint. The "add" action moves to a "+" in the navigation bar (TopBar).
function IOSTabItem({ to, label, Icon }) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 ${
          isActive ? 'text-brand-600' : 'text-slate-500'
        }`
      }
    >
      <Icon size={24} strokeWidth={2} />
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </NavLink>
  );
}

export default function BottomNav({ onAdd }) {
  const { showLabels, skin } = useUIPreferences();
  const { t } = useT();

  if (skin === 'ios') {
    const all = [...items, ...itemsRight];
    return (
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/80 backdrop-blur-xl safe-bottom">
        <div className="mx-auto flex max-w-md items-stretch">
          {all.map((it) => (
            <IOSTabItem key={it.to} to={it.to} Icon={it.Icon} label={t(it.labelKey)} />
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white safe-bottom">
      <div className="mx-auto flex max-w-md items-center">
        {items.map((it) => (
          <NavItem key={it.to} to={it.to} Icon={it.Icon} label={t(it.labelKey)} showLabels={showLabels} />
        ))}
        <div className="flex flex-1 items-center justify-center">
          <button
            onClick={onAdd}
            aria-label={t('nav.addEvent')}
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg hover:bg-brand-600"
          >
            <Plus size={26} />
          </button>
        </div>
        {itemsRight.map((it) => (
          <NavItem key={it.to} to={it.to} Icon={it.Icon} label={t(it.labelKey)} showLabels={showLabels} />
        ))}
      </div>
    </nav>
  );
}
