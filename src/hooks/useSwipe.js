import { useRef } from 'react';

// Horizontal swipe on touch screens: returns handlers to spread onto the
// element. A swipe counts when the finger travels at least `threshold` pixels
// sideways and clearly more sideways than up or down, so scrolling the page
// never flips the week by accident.
//
//   const swipe = useSwipe({ onLeft: next, onRight: prev });
//   <div {...swipe}>…</div>
export default function useSwipe({ onLeft, onRight, threshold = 50 }) {
  const start = useRef(null);

  function onTouchStart(e) {
    if (e.touches.length !== 1) {
      start.current = null;
      return;
    }
    const touch = e.touches[0];
    start.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(e) {
    const from = start.current;
    start.current = null;
    if (!from) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - from.x;
    const dy = touch.clientY - from.y;
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) onLeft?.();
    else onRight?.();
  }

  return { onTouchStart, onTouchEnd };
}
