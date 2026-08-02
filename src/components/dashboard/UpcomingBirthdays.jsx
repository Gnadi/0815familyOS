import { Cake } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import useT from '../../hooks/useT';

const DAY = 24 * 60 * 60 * 1000;

function nextBirthday(birthdayISO, today = new Date()) {
  if (!birthdayISO) return null;
  const [y, m, d] = birthdayISO.split('-').map(Number);
  if (!y || !m || !d) return null;
  const thisYear = new Date(today.getFullYear(), m - 1, d);
  const cmp = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const next =
    thisYear < cmp ? new Date(today.getFullYear() + 1, m - 1, d) : thisYear;
  const turning = next.getFullYear() - y;
  const daysUntil = Math.round((next - cmp) / DAY);
  return { next, turning, daysUntil };
}

function describe(daysUntil, t) {
  if (daysUntil === 0) return t('dashboard.bdToday');
  if (daysUntil === 1) return t('dashboard.bdTomorrow');
  return t('dashboard.bdInDays', { days: daysUntil });
}

export default function UpcomingBirthdays() {
  const { family } = useAuth();
  const { t, locale } = useT();
  const today = new Date();

  // Gift recipients (grandparents, godparents, …) carry a birthday too — it is
  // the whole point of storing one — so they belong on this list next to the
  // kids. Ids are prefixed per list (kid_… / recip_…), so they never collide.
  const people = [...(family?.kids || []), ...(family?.giftRecipients || [])];

  const upcoming = people
    .map((p) => ({ kid: p, info: nextBirthday(p.birthday, today) }))
    .filter((row) => row.info && row.info.daysUntil <= 60)
    .sort((a, b) => a.info.daysUntil - b.info.daysUntil);

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
