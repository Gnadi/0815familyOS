import { useCallback, useEffect, useRef, useState } from 'react';

// Copy with visible feedback. The two existing call sites fired
// `navigator.clipboard?.writeText(...)` and told the user nothing at all —
// including when it silently did nothing, which is what happens on iOS Safari
// outside a secure context.
export default function useCopyToClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text) => {
      const value = String(text || '');
      if (!value) return false;
      let ok = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
          ok = true;
        }
      } catch {
        ok = false;
      }
      if (!ok) ok = legacyCopy(value);
      if (ok) {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), resetMs);
      }
      return ok;
    },
    [resetMs],
  );

  return [copied, copy];
}

// Fallback for browsers without the async clipboard API, or pages served over
// plain http where it is unavailable.
function legacyCopy(value) {
  try {
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  }
}
