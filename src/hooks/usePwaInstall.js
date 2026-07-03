import { useCallback, useEffect, useState } from 'react';

const DISMISS_KEY = 'familyos:pwa-install-dismissed';
// How long a dismissal is honoured before the prompt may reappear (30 days).
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari exposes navigator.standalone instead of display-mode.
    window.navigator.standalone === true
  );
}

function isIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOSDevice = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ reports as Mac; detect the touch-capable "Mac".
  const iPadOS = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

function wasRecentlyDismissed() {
  if (typeof window === 'undefined') return false;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts < DISMISS_TTL_MS;
}

// Encapsulates PWA install eligibility and the native prompt.
//
// Returns:
//   canInstall  — a native beforeinstallprompt was captured (Chromium/Android)
//   isIos       — the platform needs manual "Add to Home Screen" instructions
//   installed   — the app is already running standalone / just got installed
//   promptInstall() — fires the native prompt; resolves to the user's choice
//   dismiss()   — remember the user said "not now" for DISMISS_TTL_MS
export default function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIos());

    const onBeforeInstall = (e) => {
      // Stop Chrome's mini-infobar so we can show our own modal instead.
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return null;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // A given beforeinstallprompt event can only be used once.
    setDeferredPrompt(null);
    return outcome;
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
  }, []);

  return {
    canInstall: !!deferredPrompt,
    isIos: ios,
    installed,
    wasRecentlyDismissed,
    promptInstall,
    dismiss,
  };
}
