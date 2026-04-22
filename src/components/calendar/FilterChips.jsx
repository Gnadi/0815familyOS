// All Tailwind class names are hardcoded here to ensure they survive the
// production content scan (no dynamic interpolation).
const CHIP_COLORS = {
  slate:  { dot: 'bg-slate-400',   activeBg: 'bg-slate-100',   activeText: 'text-slate-700' },
  red:    { dot: 'bg-red-500',     activeBg: 'bg-red-50',      activeText: 'text-red-700' },
  blue:   { dot: 'bg-blue-500',    activeBg: 'bg-blue-50',     activeText: 'text-blue-700' },
  emerald:{ dot: 'bg-emerald-500', activeBg: 'bg-emerald-50',  activeText: 'text-emerald-700' },
  amber:  { dot: 'bg-amber-500',   activeBg: 'bg-amber-50',    activeText: 'text-amber-700' },
  violet: { dot: 'bg-violet-500',  activeBg: 'bg-violet-50',   activeText: 'text-violet-700' },
  sky:    { dot: 'bg-sky-500',     activeBg: 'bg-sky-50',      activeText: 'text-sky-700' },
  pink:   { dot: 'bg-pink-500',    activeBg: 'bg-pink-50',     activeText: 'text-pink-700' },
  teal:   { dot: 'bg-teal-500',    activeBg: 'bg-teal-50',     activeText: 'text-teal-700' },
  orange: { dot: 'bg-orange-500',  activeBg: 'bg-orange-50',   activeText: 'text-orange-700' },
  indigo: { dot: 'bg-indigo-500',  activeBg: 'bg-indigo-50',   activeText: 'text-indigo-700' },
  cyan:   { dot: 'bg-cyan-500',    activeBg: 'bg-cyan-50',     activeText: 'text-cyan-700' },
};

export default function FilterChips({ chips, selected, onToggle }) {
  const isAllActive = selected.size === 0;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {chips.map((chip) => {
        const colors = CHIP_COLORS[chip.colorKey] || CHIP_COLORS.slate;
        const isAll = chip.id === 'all';
        const isActive = isAll ? isAllActive : selected.has(chip.id);

        return (
          <button
            key={chip.id}
            onClick={() => onToggle(chip.id)}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? `${colors.activeBg} ${colors.activeText}`
                : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            <span className={`h-2 w-2 rounded-full flex-shrink-0 ${colors.dot}`} />
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
