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
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {ios && (
          <div className="flex justify-center pt-2.5">
            <span className="h-1 w-9 rounded-full bg-slate-300" />
          </div>
        )}
        <div className={`flex items-center justify-between px-5 ${ios ? 'pt-3' : 'pt-5'}`}>
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
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="border-t border-slate-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
