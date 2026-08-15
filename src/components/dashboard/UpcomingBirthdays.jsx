import { Cake } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import useT from '../../hooks/useT';
import { upcomingBirthdays } from '../../utils/birthdays';

function describe(daysUntil, t) {
  if (daysUntil === 0) return t('dashboard.bdToday');
  if (daysUntil === 1) return t('dashboard.bdTomorrow');
  return t('dashboard.bdInDays', { days: daysUntil });
}

export default function UpcomingBirthdays() {
  const { family } = useAuth();
  const { t, locale } = useT();
  const today = new Date();

  // Shared with the reminder centre — see utils/birthdays.js.
  const upcoming = upcomingBirthdays(family, { withinDays: 60, today }).map((row) => ({
    kid: row.person,
    info: row.info,
  }));

  if (upcoming.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-bold text-slate-900">{t('dashboard.upcomingBirthdays')}</h2>
      <div className="mt-3 space-y-2">
        {upcoming.map(({ kid, info }) => (
          <div
            key={kid.id}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100 text-pink-600">
              <Cake size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">
                {t('dashboard.birthdayTurns', { name: kid.name, age: info.turning })}
              </p>
              <p className="text-xs text-slate-500">
                {describe(info.daysUntil, t)} ·{' '}
                {info.next.toLocaleDateString(locale, {
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
