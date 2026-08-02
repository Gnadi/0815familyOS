import { useEffect, useState } from 'react';

// QR rendering for the invite link.
//
// The encoder is dynamically imported so it never lands in the pre-rendered
// landing-page chunk — this component is only reachable from lazy routes, and
// the import keeps it in a chunk of its own.
//
// Deliberately not a remote image service: the URL would carry the invite
// token, i.e. the access secret, to a third party. Deliberately not
// hand-rolled either — a correct encoder is Reed-Solomon over GF(256), version
// and error-correction selection, and eight mask patterns with penalty
// scoring; a silent bug would produce a code that scans to the wrong token.
//
// Rendered as a single <path> rather than one rect per module: ~700 DOM nodes
// become one, and it scales and prints cleanly.
export default function QrCode({ value, size = 200, label }) {
  const [path, setPath] = useState(null);
  const [count, setCount] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!value) return undefined;
    (async () => {
      try {
        const { default: qrcode } = await import('qrcode-generator');
        if (cancelled) return;
        // Type 0 = auto-pick the smallest version that fits; 'M' tolerates
        // ~15% damage, which is plenty for a screen or a printout.
        const qr = qrcode(0, 'M');
        qr.addData(value);
        qr.make();
        const modules = qr.getModuleCount();
        let d = '';
        for (let row = 0; row < modules; row += 1) {
          for (let col = 0; col < modules; col += 1) {
            if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
          }
        }
        setCount(modules);
        setPath(d);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (failed || !path) {
    return (
      <div
        className="mx-auto animate-pulse rounded-xl bg-slate-100"
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${count} ${count}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="mx-auto rounded-xl bg-white p-2"
    >
      <rect width={count} height={count} fill="#fff" />
      <path d={path} fill="#0F172A" />
    </svg>
  );
}
