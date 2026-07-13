import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { QUICK_ACCESS_ENTRIES } from '../../constants/quickAccessEntries';
import useUIPreferences from '../../hooks/useUIPreferences';
import useT from '../../hooks/useT';

function Tile({ icon: Icon, label, bg, color, to }) {
  return (
    <Link
      to={to}
      className={`flex flex-1 flex-col items-start gap-3 rounded-2xl p-5 text-left ${bg}`}
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
  const { skin, quickAccess } = useUIPreferences();
  const { t } = useT();

  // The visible shortcuts (and their order) are a user preference edited in
  // Settings → Quick Access.
  const entries = quickAccess
    .map((id) => QUICK_ACCESS_ENTRIES.find((e) => e.id === id))
    .filter(Boolean);

  if (entries.length === 0) return null;

  if (skin === 'ios') {
    return (
      <section>
        <h2 className="px-1 text-lg font-bold text-slate-900">{t('dashboard.quickAccess')}</h2>
        <div className="mt-3 overflow-hidden rounded-2xl bg-white">
          {entries.map((e, i) => (
            <div key={e.id}>
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
        {entries.map((e) => (
          <Tile key={e.id} {...e} label={t(e.labelKey)} />
        ))}
      </div>
    </section>
  );
}
