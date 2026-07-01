// The Family OS brand mark: a gabled roof with a heart carved out of the
// negative space — "one family under one roof". Unlike the old lucide `Home`
// glyph, this is a bespoke, ownable silhouette that stays legible from a 16px
// favicon up to the hero header.
//
// It carries fixed signature colors on purpose. The rest of the UI accent is
// themeable (blue/emerald/rose/violet/amber), but a logo should keep one
// constant identity rather than recolor with the current theme, so the marks
// here are hard-coded and independent of the `brand-*` tokens.

const INDIGO = '#4F46E5';
const HEART = '#FB7185';

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
      <path d="M13 32 L32 14 L51 32 V48 a3 3 0 0 1-3 3 H16 a3 3 0 0 1-3-3 Z" fill="#fff" />
      <path
        d="M32 45 c-6.5-4.2-9.5-7.3-9.5-11.3 a4.3 4.3 0 0 1 9.5-1.1 a4.3 4.3 0 0 1 9.5 1.1 c0 4-3 7.1-9.5 11.3 Z"
        fill={HEART}
      />
    </svg>
  );
}
