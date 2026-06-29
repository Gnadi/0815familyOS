import { useEffect } from 'react';
import { X } from 'lucide-react';
import useUIPreferences from '../../hooks/useUIPreferences';

export default function Modal({ open, onClose, title, children, footer }) {
  const { skin } = useUIPreferences();
  const ios = skin === 'ios';
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center"
      // With viewport-fit=cover the page background paints into the top
      // safe area (status bar / notch). Pull the backdrop up by that inset so
      // it covers the full screen on mobile instead of leaving a light strip.
      style={{ top: 'calc(-1 * env(safe-area-inset-top, 0px))' }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:max-h-[88vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {ios && (
          <div className="flex shrink-0 justify-center pt-2.5">
            <span className="h-1 w-9 rounded-full bg-slate-300" />
          </div>
        )}
        <div className={`flex shrink-0 items-center justify-between px-5 ${ios ? 'pt-3' : 'pt-5'}`}>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className={
              ios
                ? 'flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 active:opacity-60'
                : 'rounded-full p-1.5 text-slate-500 hover:bg-slate-100'
            }
            aria-label="Close"
          >
            <X size={ios ? 16 : 18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-slate-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
