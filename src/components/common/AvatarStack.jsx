import { COLOR_PALETTE, PALETTE_COLORS } from '../../constants/eventCategories';
import { hashToIndex, initialsOf } from '../../utils/tasks';

// Hardcoded so Tailwind's content-scan keeps them:
const BG_BY_COLOR = {
  slate: 'bg-slate-500',
  blue: 'bg-brand-500',
  red: 'bg-red-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
  pink: 'bg-pink-500',
  cyan: 'bg-cyan-500',
};

const SIZES = {
  sm: { dot: 'h-7 w-7 text-[11px]', overlap: '-ml-2', ring: 'ring-2 ring-white' },
  md: { dot: 'h-9 w-9 text-xs', overlap: '-ml-2.5', ring: 'ring-2 ring-white' },
  lg: { dot: 'h-10 w-10 text-sm', overlap: '-ml-3', ring: 'ring-[3px] ring-white' },
};

function colorForUid(uid) {
  if (!uid) return 'slate';
  return PALETTE_COLORS[hashToIndex(uid, PALETTE_COLORS.length)];
}

export default function AvatarStack({ members = [], max = 3, size = 'sm' }) {
  const visible = members.slice(0, max);
  const overflow = Math.max(0, members.length - visible.length);
  const { dot, overlap, ring } = SIZES[size] || SIZES.sm;

  if (!members.length) return null;

  return (
    <div className="flex items-center">
      {visible.map((m, i) => {
        const color = colorForUid(m.uid);
        const bg = BG_BY_COLOR[color] || COLOR_PALETTE.slate.swatch;
        return (
          <div
            key={m.uid}
            className={`flex items-center justify-center rounded-full font-semibold text-white ${bg} ${dot} ${ring} ${
              i === 0 ? '' : overlap
            }`}
            title={m.displayName}
          >
            {initialsOf(m.displayName)}
          </div>
        );
      })}
      {overflow > 0 && (
        <div
          className={`flex items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600 ${dot} ${ring} ${overlap}`}
          title={`${overflow} more`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
