// Lock background scrolling while an overlay (modal / fullscreen mode) is open.
//
// We pin <body> with position:fixed instead of toggling `overflow: hidden`.
// On mobile — notably Chrome Android — flipping body overflow can reflow the
// dynamic browser toolbar and leave a fixed-position backdrop offset from the
// top of the viewport (a light strip above the dimmed page). Pinning the body
// freezes the page without that reflow. The current scroll position is captured
// on lock and restored on release.
//
// Returns a cleanup function that releases the lock.
export function lockBodyScroll() {
  if (typeof document === 'undefined') return () => {};

  const { body } = document;
  const scrollY = window.scrollY;

  const prev = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
  };

  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';

  return () => {
    body.style.position = prev.position;
    body.style.top = prev.top;
    body.style.left = prev.left;
    body.style.right = prev.right;
    body.style.width = prev.width;
    body.style.overflow = prev.overflow;
    window.scrollTo(0, scrollY);
  };
}
