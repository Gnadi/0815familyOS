import { Link } from 'react-router-dom';
import { ChevronRight, FileText, Gift, ShoppingBasket, Syringe } from 'lucide-react';
import useUIPreferences from '../../hooks/useUIPreferences';
import useT from '../../hooks/useT';

const ENTRIES = [
  { icon: FileText,       labelKey: 'dashboard.qaDocumentVault', bg: 'bg-emerald-50', color: 'text-emerald-600', tile: 'bg-emerald-50', to: '/vault' },
  { icon: Gift,           labelKey: 'dashboard.qaGiftPlanner',   bg: 'bg-violet-50',  color: 'text-violet-600',  tile: 'bg-violet-50',  to: '/gifts' },
  { icon: Syringe,        labelKey: 'dashboard.qaHealthLedger',  bg: 'bg-red-50',     color: 'text-red-500',     tile: 'bg-red-50',     to: '/health' },
  { icon: ShoppingBasket, labelKey: 'dashboard.qaShoppingList',  bg: 'bg-amber-50',   color: 'text-amber-600',   tile: 'bg-amber-50',   to: '/shopping' },
];

function Tile({ icon: Icon, label, tile, color, to }) {
  return (
    <Link
      to={to}
      className={`flex flex-1 flex-col items-start gap-3 rounded-2xl p-5 text-left ${tile}`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-white ${color}`}>
        <Icon size={18} />
      </div>
      <span className="text-sm font-semibold text-slate-900">{label}</span>
    </Link>
  );
}

// iOS surfaces these as an inset grouped list: one rounded container of rows,
// each with a colored rounded-square icon, label and a disclosure chevron.
function Row({ icon: Icon, label, color, bg, to }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3 active:bg-slate-50">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg} ${color}`}>
        <Icon size={17} />
      </div>
      <span className="flex-1 text-sm font-medium text-slate-900">{label}</span>
      <ChevronRight size={18} className="text-slate-300" />
    </Link>
  );
}

export default function QuickAccess() {
  const { skin } = useUIPreferences();
  const { t } = useT();

  if (skin === 'ios') {
    return (
      <section>
        <h2 className="px-1 text-lg font-bold text-slate-900">{t('dashboard.quickAccess')}</h2>
        <div className="mt-3 overflow-hidden rounded-2xl bg-white">
          {ENTRIES.map((e, i) => (
            <div key={e.to}>
              {i > 0 && <div className="ml-[3.75rem] h-px bg-slate-100" />}
              <Row {...e} label={t(e.labelKey)} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-bold text-slate-900">{t('dashboard.quickAccess')}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {ENTRIES.map((e) => (
          <Tile key={e.to} {...e} label={t(e.labelKey)} />
        ))}
      </div>
    </section>
  );
}
