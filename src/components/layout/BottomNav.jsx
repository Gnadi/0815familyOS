import { NavLink } from 'react-router-dom';
import { Plus } from 'lucide-react';
import useUIPreferences from '../../hooks/useUIPreferences';
import useNavLayout from '../../hooks/useNavLayout';
import useT from '../../hooks/useT';
import { BOTTOM_NAV_ENTRIES } from '../../constants/bottomNavEntries';

function NavItem({ to, label, Icon, showLabels }) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className={({ isActive }) =>
        `flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 ${
          isActive ? 'text-brand-600' : 'text-slate-500'
        }`
      }
    >
      <Icon size={showLabels ? 22 : 26} />
      {showLabels && (
        // Keep labels on a single line. Nav labels are kept short per locale
        // (e.g. "Konto" instead of "Einstellungen") so they fit the narrow
        // column without wrapping into the neighbouring item.
        <span className="block w-full px-0.5 text-center text-[11px] font-medium leading-tight whitespace-nowrap">
          {label}
        </span>
      )}
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
        `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 ${
          isActive ? 'text-brand-600' : 'text-slate-500'
        }`
      }
    >
      <Icon size={24} strokeWidth={2} />
      <span className="block w-full px-0.5 text-center text-[10px] font-medium leading-none whitespace-nowrap">
        {label}
      </span>
    </NavLink>
  );
}

export default function BottomNav({ onAdd }) {
  const { showLabels, skin } = useUIPreferences();
  const { bottomNav } = useNavLayout();
  const { t } = useT();

  // The tabs (and their order) are a family setting, see Settings → Navigation.
  const all = bottomNav
    .map((id) => BOTTOM_NAV_ENTRIES.find((e) => e.id === id))
    .filter(Boolean);

  if (skin === 'ios') {
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

  // The "+" sits in the middle; with an odd count the extra tab goes left.
  const split = Math.ceil(all.length / 2);
  const items = all.slice(0, split);
  const itemsRight = all.slice(split);

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
