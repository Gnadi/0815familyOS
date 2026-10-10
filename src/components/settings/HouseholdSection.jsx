import { useMemo, useState } from 'react';
import { CalendarDays, Home, ListChecks, Minus, Plus } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import useT from '../../hooks/useT';
import { updateHousehold } from '../../services/families';
import { MAX_ADULTS, householdPortions, normalizeHousehold } from '../../utils/household';
import { format, getWeekDays } from '../../utils/date';

// Who eats at home and how the family shops. Feeds the smart shopping list:
// portions scale planned recipes, the mode and day shape the weekly proposal.
// See docs/smart-shopping.md.
export default function HouseholdSection() {
  const { family } = useAuth();
  const { t, locale } = useT();
  const [error, setError] = useState('');

  const memberCount = family?.memberIds?.length || 1;
  const household = normalizeHousehold(family?.household, memberCount);
  const portions = householdPortions({ household: family?.household, kids: family?.kids, memberCount });
  const number = (n) => n.toLocaleString(locale, { maximumFractionDigits: 1 });

  // Monday-first, matching the rest of the app; values are Date#getDay().
  const days = useMemo(() => getWeekDays(new Date()), []);

  async function save(patch) {
    if (!family?.id) return;
    setError('');
    try {
      await updateHousehold(family.id, family.household, patch);
    } catch (err) {
      setError(err.message || t('settings.householdSaveFailed'));
    }
  }

  const modes = [
    { id: 'continuous', label: t('settings.modeContinuous'), desc: t('settings.modeContinuousDesc') },
    { id: 'weekly', label: t('settings.modeWeekly'), desc: t('settings.modeWeeklyDesc') },
  ];

  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        <Home size={14} /> {t('settings.household')}
      </h2>
      <p className="mt-3 text-sm text-slate-600">{t('settings.householdDesc')}</p>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
        <span className="text-sm font-semibold text-slate-900">{t('settings.adults')}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => save({ adults: household.adults - 1 })}
            disabled={household.adults <= 1}
            aria-label={t('settings.fewerAdults')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-xs hover:bg-slate-100 disabled:opacity-40"
          >
            <Minus size={16} />
          </button>
          <span className="w-6 text-center text-base font-semibold text-slate-900" aria-live="polite">
            {household.adults}
          </span>
          <button
            type="button"
            onClick={() => save({ adults: household.adults + 1 })}
            disabled={household.adults >= MAX_ADULTS}
            aria-label={t('settings.moreAdults')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-xs hover:bg-slate-100 disabled:opacity-40"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="mt-2 rounded-xl bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-900">
          {t('settings.portionsTotal', { portions: number(portions.total) })}
        </p>
        {portions.kids.length > 0 ? (
          <p className="mt-1 text-xs text-slate-500">
            {t('settings.portionsKidsLead')}{' '}
            {portions.kids
              .map((kid) =>
                kid.age === null
                  ? t('settings.kidPortionNoAge', { name: kid.name, portion: number(kid.portion) })
                  : t('settings.kidPortion', { name: kid.name, age: kid.age, portion: number(kid.portion) }),
              )
              .join(' · ')}
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">{t('settings.portionsNoKids')}</p>
        )}
      </div>

      <p className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-700">
        <ListChecks size={16} className="text-slate-400" /> {t('settings.shoppingMode')}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('settings.shoppingMode')}>
        {modes.map((mode) => {
          const active = household.shoppingMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => !active && save({ shoppingMode: mode.id })}
              className={`rounded-xl border p-3 text-left transition-colors ${
                active
                  ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <span className={`block text-sm font-semibold ${active ? 'text-brand-600' : 'text-slate-900'}`}>
                {mode.label}
              </span>
              <span className="mt-1 block text-xs leading-snug text-slate-500">{mode.desc}</span>
            </button>
          );
        })}
      </div>

      {household.shoppingMode === 'weekly' && (
        <>
          <p className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-700">
            <CalendarDays size={16} className="text-slate-400" /> {t('settings.shoppingDay')}
          </p>
          <div className="mt-2 grid grid-cols-7 gap-1.5" role="radiogroup" aria-label={t('settings.shoppingDay')}>
            {days.map((day) => {
              const value = day.getDay();
              const active = household.shoppingDay === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={format(day, 'EEEE')}
                  onClick={() => !active && save({ shoppingDay: value })}
                  className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                    active ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {format(day, 'EEEEEE')}
                </button>
              );
            })}
          </div>
        </>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
