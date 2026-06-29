import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useUIPreferences from '../../hooks/useUIPreferences';
import useT from '../../hooks/useT';
import { lockBodyScroll } from '../../utils/scrollLock';

export default function Modal({ open, onClose, title, children, footer }) {
  const { skin } = useUIPreferences();
  const { t } = useT();
  const ios = skin === 'ios';

  // Escape-to-close.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Freeze the background while the sheet is open. Depends only on `open` so the
  // captured scroll position isn't clobbered if `onClose` changes identity.
  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  // Portal to <body> so the overlay can never inherit a stacking/containing
  // context from an ancestor. height:100dvh pins it to the dynamic viewport
  // (falls back to inset-0's bottom:0 where dvh is unsupported).
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center"
      style={{ height: '100dvh' }}
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
            aria-label={t('common.close')}
          >
            <X size={ios ? 16 : 18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-slate-100 px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
