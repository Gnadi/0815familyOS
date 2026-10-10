import { useState } from 'react';
import { ArrowDown, ArrowUp, LayoutGrid, PanelBottom, RotateCcw } from 'lucide-react';
import useNavLayout from '../../hooks/useNavLayout';
import useT from '../../hooks/useT';
import { QUICK_ACCESS_ENTRIES } from '../../constants/quickAccessEntries';
import {
  BOTTOM_NAV_ENTRIES,
  BOTTOM_NAV_MAX,
  BOTTOM_NAV_MIN,
  BOTTOM_NAV_REQUIRED,
} from '../../constants/bottomNavEntries';
import { moveId, toggleId } from '../../utils/navLayout';

// One editable list: enabled entries first (in their chosen order, with
// up/down buttons), then the rest unticked. `renderIcon` lets each list keep
// its own look — tinted squares for Quick Access, plain glyphs for the bar.
function OrderedPicker({ entries, selected, onChange, min = 0, max = Infinity, required = [], renderIcon, toggleLabelKey }) {
  const { t } = useT();
  const rows = [
    ...selected.map((id) => entries.find((e) => e.id === id)).filter(Boolean),
    ...entries.filter((e) => !selected.includes(e.id)),
  ];

  return (
    <div className="mt-3 space-y-2">
      {rows.map((entry) => {
        const label = t(entry.labelKey);
        const enabled = selected.includes(entry.id);
        const position = selected.indexOf(entry.id);
        const locked = enabled
          ? selected.length <= min || required.includes(entry.id)
          : selected.length >= max;
        return (
          <div key={entry.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            {renderIcon(entry)}
            <span className={`flex-1 text-sm font-medium ${enabled ? 'text-slate-900' : 'text-slate-400'}`}>
              {label}
            </span>
            {enabled && (
              <>
                <button
                  type="button"
                  onClick={() => onChange(moveId(selected, entry.id, -1))}
                  disabled={position === 0}
                  aria-label={t('settings.moveUp', { name: label })}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(moveId(selected, entry.id, 1))}
                  disabled={position === selected.length - 1}
                  aria-label={t('settings.moveDown', { name: label })}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                >
                  <ArrowDown size={15} />
                </button>
              </>
            )}
            <input
              type="checkbox"
              checked={enabled}
              disabled={locked}
              onChange={() => onChange(toggleId(selected, entry.id))}
              aria-label={t(toggleLabelKey, { name: label })}
              className="h-5 w-5 rounded-sm border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-40"
            />
          </div>
        );
      })}
    </div>
  );
}

// Settings → Navigation: which tabs sit in the bottom bar and which shortcuts
// the Dashboard's Quick Access shows. Both are stored on the family, so this
// shapes the app for every member.
export default function NavLayoutSection() {
  const { bottomNav, quickAccess, canEdit, customised, setBottomNav, setQuickAccess, resetNavLayout } = useNavLayout();
  const { t } = useT();
  const [error, setError] = useState('');

  function save(write) {
    setError('');
    write().catch((err) => {
      console.error(err);
      setError(t('settings.navSaveFailed'));
    });
  }

  return (
    <>
      {canEdit && (
        <section className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            <PanelBottom size={14} /> {t('settings.bottomNav')}
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            {t('settings.bottomNavDesc', { min: BOTTOM_NAV_MIN, max: BOTTOM_NAV_MAX })}
          </p>
          <OrderedPicker
            entries={BOTTOM_NAV_ENTRIES}
            selected={bottomNav}
            onChange={(next) => save(() => setBottomNav(next))}
            min={BOTTOM_NAV_MIN}
            max={BOTTOM_NAV_MAX}
            required={BOTTOM_NAV_REQUIRED}
            toggleLabelKey="settings.toggleNavTab"
            renderIcon={({ Icon }) => (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-600">
                <Icon size={17} />
              </div>
            )}
          />
        </section>
      )}

      <section className="rounded-2xl bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          <LayoutGrid size={14} /> {t('settings.quickAccess')}
        </h2>
        <p className="mt-3 text-sm text-slate-600">{t('settings.quickAccessDesc')}</p>
        <OrderedPicker
          entries={QUICK_ACCESS_ENTRIES}
          selected={quickAccess}
          onChange={(next) => save(() => setQuickAccess(next))}
          toggleLabelKey="settings.toggleShortcut"
          renderIcon={({ icon: Icon, bg, color }) => (
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg} ${color}`}>
              <Icon size={17} />
            </div>
          )}
        />
        {canEdit && <p className="mt-3 text-xs text-slate-500">{t('settings.navFamilyWide')}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {(customised || !canEdit) && (
          <button
            type="button"
            onClick={() => {
              if (confirm(t('settings.navResetConfirm'))) save(resetNavLayout);
            }}
            className="mt-3 flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
          >
            <RotateCcw size={15} />
            {t('settings.navReset')}
          </button>
        )}
      </section>
    </>
  );
}
