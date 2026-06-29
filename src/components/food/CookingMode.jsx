import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ListChecks, X } from 'lucide-react';
import { lockBodyScroll } from '../../utils/scrollLock';

// Fullscreen, step-at-a-time cooking guide. Screen 0 is the ingredients
// overview; screens 1..N each show one instruction step in large type.
export default function CookingMode({ open, onClose, recipe }) {
  const ingredients = recipe?.ingredients || [];
  const steps = recipe?.instructions || [];
  const total = steps.length + 1; // +1 for the ingredients intro

  const [screen, setScreen] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);

  // Reset to the intro whenever a cooking session (re)starts.
  useEffect(() => {
    if (open) {
      setScreen(0);
      setShowIngredients(false);
    }
  }, [open, recipe?.id]);

  const next = useCallback(() => setScreen((s) => Math.min(s + 1, total - 1)), [total]);
  const back = useCallback(() => setScreen((s) => Math.max(s - 1, 0)), []);

  // Keyboard navigation: arrows step, Escape exits.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
      else if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, next, back, onClose]);

  // Freeze the background (same approach as Modal — see utils/scrollLock).
  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  // Best-effort screen wake lock so the screen doesn't dim mid-recipe. Silently
  // ignored on browsers without the API.
  useEffect(() => {
    if (!open || !('wakeLock' in navigator)) return undefined;
    let lock = null;
    let released = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* unsupported or denied — fine to ignore */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !released) request();
    };
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release?.().catch(() => {});
    };
  }, [open]);

  if (!open || !recipe || typeof document === 'undefined') return null;

  const onIntro = screen === 0;
  const stepText = onIntro ? null : steps[screen - 1];

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-white" style={{ height: '100dvh' }}>
      {/* Header: progress + exit */}
      <div className="flex items-center gap-3 px-5 pt-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-500">{recipe.title}</p>
          <div className="mt-2 flex gap-1.5">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition ${
                  i <= screen ? 'bg-brand-500' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Exit cooking mode"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95"
        >
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col overflow-y-auto px-6 py-8">
        {onIntro ? (
          <div className="mx-auto w-full max-w-lg">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Ingredients</h2>
            {ingredients.length > 0 ? (
              <ul className="mt-6 space-y-4">
                {ingredients.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-xl leading-snug text-slate-800">
                    <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 text-lg text-slate-400">No ingredients listed.</p>
            )}
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
            <p className="text-sm font-bold uppercase tracking-wider text-brand-500">
              Step {screen} of {steps.length}
            </p>
            <p className="mt-4 text-3xl font-medium leading-snug tracking-tight text-slate-900">
              {stepText}
            </p>
          </div>
        )}
      </div>

      {/* Ingredients slide-over (reachable during steps) */}
      {showIngredients && !onIntro && (
        <div
          className="absolute inset-0 z-10 flex flex-col bg-white/95 backdrop-blur"
          onClick={() => setShowIngredients(false)}
        >
          <div className="flex items-center justify-between px-6 pt-6">
            <h2 className="text-2xl font-bold text-slate-900">Ingredients</h2>
            <button
              type="button"
              onClick={() => setShowIngredients(false)}
              aria-label="Close ingredients"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600"
            >
              <X size={20} />
            </button>
          </div>
          <ul className="space-y-4 overflow-y-auto px-6 py-6">
            {ingredients.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-xl leading-snug text-slate-800">
                <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer controls */}
      <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-4">
        <button
          type="button"
          onClick={back}
          disabled={screen === 0}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition active:scale-95 disabled:opacity-30"
          aria-label="Previous"
        >
          <ChevronLeft size={26} />
        </button>

        {!onIntro && ingredients.length > 0 && (
          <button
            type="button"
            onClick={() => setShowIngredients(true)}
            className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 active:scale-95"
          >
            <ListChecks size={20} /> Ingredients
          </button>
        )}

        {screen < total - 1 ? (
          <button
            type="button"
            onClick={next}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-500 text-lg font-semibold text-white transition active:scale-[0.99]"
          >
            {onIntro ? 'Start cooking' : 'Next'} <ChevronRight size={24} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-lg font-semibold text-white transition active:scale-[0.99]"
          >
            Done
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
