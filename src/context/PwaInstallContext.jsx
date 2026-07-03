import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import usePwaInstall from '../hooks/usePwaInstall';

// How long after the page settles before the install invitation auto-appears.
const AUTO_OPEN_DELAY_MS = 3500;

const PwaInstallContext = createContext(null);

// Owns the single source of truth for PWA install state so both the modal
// (InstallPrompt) and any manual entry points (e.g. the footer "Install app"
// link) share the same eligibility and open/close controls.
export function PwaInstallProvider({ children }) {
  const install = usePwaInstall();
  const { canInstall, isIos, installed, wasRecentlyDismissed } = install;
  const [open, setOpen] = useState(false);

  // Auto-open once the app is installable (or on iOS) and the user hasn't
  // recently dismissed it or already installed.
  useEffect(() => {
    if (installed) return undefined;
    if (!canInstall && !isIos) return undefined;
    if (wasRecentlyDismissed()) return undefined;
    const timer = setTimeout(() => setOpen(true), AUTO_OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [canInstall, isIos, installed, wasRecentlyDismissed]);

  // Manual open (footer link) — bypasses the dismissal window on purpose:
  // the user explicitly asked to install.
  const openInstall = useCallback(() => setOpen(true), []);
  const closeInstall = useCallback(() => setOpen(false), []);

  // Whether to surface a manual entry point at all: not already installed, and
  // either a native prompt is available or we can show iOS instructions.
  const canShowInstall = !installed && (canInstall || isIos);

  const value = useMemo(
    () => ({ ...install, open, openInstall, closeInstall, canShowInstall }),
    [install, open, openInstall, closeInstall, canShowInstall],
  );

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstallContext() {
  return useContext(PwaInstallContext);
}
