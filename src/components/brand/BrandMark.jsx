// The Family OS brand mark: a bespoke "F" (Family) monogram on an app tile,
// with a small coral tile as an "OS" accent. Unlike the old off-the-shelf
// lucide `Home` glyph, a lettermark is unmistakably *this* app and stays
// legible from a 16px favicon up to the hero header.
//
// It carries fixed signature colors on purpose. The rest of the UI accent is
// themeable (blue/emerald/rose/violet/amber), but a logo should keep one
// constant identity rather than recolor with the current theme, so the marks
// here are hard-coded and independent of the `brand-*` tokens.

const INDIGO = '#4F46E5';
const CORAL = '#FB7185';

export default function BrandMark({ className = 'h-8 w-8', title = 'Family OS' }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <rect width="64" height="64" rx="14" fill={INDIGO} />
      {/* Stem + two arms of the "F" */}
      <rect x="22" y="16" width="7" height="33" rx="3.5" fill="#fff" />
      <rect x="22" y="16" width="22" height="7" rx="3.5" fill="#fff" />
      <rect x="22" y="28" width="15" height="7" rx="3.5" fill="#fff" />
      {/* Coral "OS" tile accent */}
      <rect x="36" y="40" width="9" height="9" rx="2.5" fill={CORAL} />
    </svg>
  );
}
