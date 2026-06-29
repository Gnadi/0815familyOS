import { useCallback, useRef } from 'react';

// Distinguishes a tap from a long-press on a single element, working for both
// touch and mouse. On long-press we fire `onLongPress` and then swallow the
// click that would otherwise follow, so the two gestures never both fire.
export default function useLongPress(onLongPress, onClick, { delay = 450, moveTolerance = 10 } = {}) {
  const timer = useRef(null);
  const firedLong = useRef(false);
  const start = useRef({ x: 0, y: 0 });

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e) => {
      // Only react to primary button / touch, never to a right-click etc.
      if (e.button != null && e.button !== 0) return;
      firedLong.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        firedLong.current = true;
        onLongPress?.(e);
      }, delay);
    },
    [onLongPress, delay],
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!timer.current) return;
      const dx = Math.abs(e.clientX - start.current.x);
      const dy = Math.abs(e.clientY - start.current.y);
      if (dx > moveTolerance || dy > moveTolerance) clear();
    },
    [clear, moveTolerance],
  );

  const onPointerUp = useCallback(
    (e) => {
      clear();
      if (firedLong.current) {
        // Suppress the synthetic click that follows the gesture.
        e.preventDefault();
        return;
      }
      onClick?.(e);
    },
    [clear, onClick],
  );

  const onContextMenu = useCallback((e) => {
    // The browser's long-press context menu would hijack our gesture on touch.
    e.preventDefault();
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu,
  };
}
