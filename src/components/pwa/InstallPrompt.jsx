import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Share, Plus, Zap, Bell, WifiOff } from 'lucide-react';
import usePwaInstall from '../../hooks/usePwaInstall';
import useT from '../../hooks/useT';

// How long after the page settles before we surface the install invitation.
const AUTO_OPEN_DELAY_MS = 3500;

// Custom "Install myFAOS" modal. Replaces the browser's default mini-infobar
// with a branded, on-message prompt. On Chromium/Android it fires the native
// install flow; on iOS Safari (which has no beforeinstallprompt) it shows the
// manual "Add to Home Screen" steps. Auto-appears once per eligible visit and
// remembers a dismissal for 30 days (see usePwaInstall).
export default function InstallPrompt() {
  const { t } = useT();
  const { canInstall, isIos, installed, wasRecentlyDismissed, promptInstall, dismiss } =
    usePwaInstall();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Auto-open once the app is installable (or on iOS) and the user hasn't
  // recently dismissed it or already installed.
  useEffect(() => {
    if (installed) return undefined;
    if (!canInstall && !isIos) return undefined;
    if (wasRecentlyDismissed()) return undefined;
    const timer = setTimeout(() => setOpen(true), AUTO_OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [canInstall, isIos, installed, wasRecentlyDismissed]);

  // Escape-to-close.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    setOpen(false);
    dismiss();
  }

  async function handleInstall() {
    const outcome = await promptInstall();
    // Whether accepted or dismissed, close our modal; remember a dismissal so
    // we don't immediately re-nag if the user said "not now" in the native UI.
    if (outcome !== 'accepted') dismiss();
    setOpen(false);
  }

  if (!mounted || !open || installed) return null;

  const benefits = [
    { Icon: Zap, key: 'benefitFast' },
    { Icon: WifiOff, key: 'benefitOffline' },
    { Icon: Bell, key: 'benefitHome' },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center"
      style={{ height: '100dvh' }}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-white/80 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label={t('common.close')}
        >
          <X size={18} />
        </button>

        {/* Branded header */}
        <div className="relative flex flex-col items-center bg-gradient-to-b from-brand-50 to-white px-6 pb-2 pt-8 text-center">
          <img
            src="/icons/icon-192.png"
            alt=""
            width={72}
            height={72}
            className="rounded-2xl shadow-lg shadow-brand-500/20"
            style={{ height: 72, width: 72 }}
          />
          <h2
            id="pwa-install-title"
            className="mt-4 text-xl font-extrabold tracking-tight text-slate-900"
          >
            {t('pwa.title')}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{t('pwa.subtitle')}</p>
        </div>

        <div className="px-6 pb-6 pt-4">
          <ul className="space-y-3">
            {benefits.map(({ Icon, key }) => (
              <li key={key} className="flex items-center gap-3 text-sm text-slate-700">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                  <Icon size={17} />
                </span>
                {t(`pwa.${key}`)}
              </li>
            ))}
          </ul>

          {isIos && !canInstall ? (
            // iOS Safari: no programmatic install — show the manual steps.
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">{t('pwa.iosHowTo')}</p>
              <ol className="mt-2 space-y-2">
                <li className="flex items-center gap-2">
                  <Share size={16} className="flex-shrink-0 text-brand-500" />
                  <span>{t('pwa.iosStep1')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Plus size={16} className="flex-shrink-0 text-brand-500" />
                  <span>{t('pwa.iosStep2')}</span>
                </li>
              </ol>
              <button
                onClick={handleClose}
                className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-600"
              >
                {t('pwa.gotIt')}
              </button>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={handleInstall}
                disabled={!canInstall}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/20 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download size={18} />
                {t('pwa.installButton')}
              </button>
              <button
                onClick={handleClose}
                className="inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                {t('pwa.notNow')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
