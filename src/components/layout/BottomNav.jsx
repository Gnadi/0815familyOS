import { NavLink } from 'react-router-dom';
import { Calendar, CheckCircle2, Gift, Home, Plus, Settings, Vault } from 'lucide-react';

const items = [
  { to: '/dashboard', label: 'Dashboard', Icon: Home },
  { to: '/calendar',  label: 'Schedule',  Icon: Calendar },
  { to: '/vault',     label: 'Vault',     Icon: Vault },
];
const itemsRight = [
  { to: '/tasks',    label: 'Tasks',    Icon: CheckCircle2 },
  { to: '/gifts',    label: 'Gifts',    Icon: Gift },
  { to: '/settings', label: 'Settings', Icon: Settings },
];

function NavItem({ to, label, Icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs ${
          isActive ? 'text-brand-600' : 'text-slate-500'
        }`
      }
    >
      <Icon size={22} />
      <span className="font-medium">{label}</span>
    </NavLink>
  );
}

export default function BottomNav({ onAdd }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white safe-bottom">
      <div className="mx-auto flex max-w-md items-center">
        {items.map((it) => (
          <NavItem key={it.to} {...it} />
        ))}
        <div className="flex flex-1 items-center justify-center">
          <button
            onClick={onAdd}
            aria-label="Add event"
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg hover:bg-brand-600"
          >
            <Plus size={26} />
          </button>
        </div>
        {itemsRight.map((it) => (
          <NavItem key={it.to} {...it} />
        ))}
      </div>
    </nav>
  );
}
