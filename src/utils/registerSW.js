// Registers the service worker (public/sw.js) after the page has loaded, so the
// initial render is never delayed by SW work. No-ops during SSR / pre-render
// and when the browser has no service-worker support.
export default function registerSW() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  // Skip during local `vite dev` — the SW is only meant for the built app.
  if (import.meta.env?.DEV) return;

  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failures are non-fatal — the app still works online.
    });
  };

  // This runs from a post-hydration effect, by which point the window `load`
  // event has usually already fired — so register immediately in that case
  // rather than waiting for an event that will never come.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
