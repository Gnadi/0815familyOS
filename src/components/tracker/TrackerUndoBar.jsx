import { Undo2 } from 'lucide-react';
import useT from '../../hooks/useT';

// A mis-tap is the likeliest mistake wherever a single tap writes an entry, so
// both the Tracker page and the Dashboard widget offer the same way back. Sits
// above the bottom nav so it never covers it.
export default function TrackerUndoBar({ name, onUndo }) {
  const { t } = useT();
  return (
    <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-5">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-lg">
        <span className="min-w-0 flex-1 truncate text-sm">{t('tracker.logged', { name })}</span>
        <button
          type="button"
          onClick={onUndo}
          className="flex flex-shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-300"
        >
          <Undo2 size={15} />
          {t('tracker.undo')}
        </button>
      </div>
    </div>
  );
}
