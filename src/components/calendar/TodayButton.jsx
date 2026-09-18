import { isToday } from 'date-fns';
import useT from '../../hooks/useT';

// Sits next to the week/month arrows. Without it, finding the way back after a
// few taps through the months means counting the steps you took to get there.
// Jumping hands out a fresh `new Date()`, which the page uses as both the new
// anchor and the new selection, so the day list below lands on today too.
export default function TodayButton({ selected, onJump }) {
  const { t } = useT();
  const alreadyThere = isToday(selected);
  return (
    <button
      type="button"
      onClick={() => onJump(new Date())}
      disabled={alreadyThere}
      aria-label={t('calendar.jumpToToday')}
      title={t('calendar.jumpToToday')}
      className="rounded-full px-3 py-2 text-sm font-semibold text-brand-600 transition hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent"
    >
      {t('common.today')}
    </button>
  );
}
