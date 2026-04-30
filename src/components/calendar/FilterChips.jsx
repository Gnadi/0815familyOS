// All Tailwind class names are hardcoded here to ensure they survive the
// production content scan (no dynamic interpolation).
const CHIP_COLORS = {
  slate:  { dot: 'bg-slate-400',   activeBg: 'bg-slate-100 dark:bg-slate-600',   activeText: 'text-slate-700 dark:text-slate-200' },
  red:    { dot: 'bg-red-500',     activeBg: 'bg-red-50 dark:bg-red-900/50',     activeText: 'text-red-700 dark:text-red-300' },
  blue:   { dot: 'bg-blue-500',    activeBg: 'bg-blue-50 dark:bg-blue-900/50',   activeText: 'text-blue-700 dark:text-blue-300' },
  emerald:{ dot: 'bg-emerald-500', activeBg: 'bg-emerald-50 dark:bg-emerald-900/50', activeText: 'text-emerald-700 dark:text-emerald-300' },
  amber:  { dot: 'bg-amber-500',   activeBg: 'bg-amber-50 dark:bg-amber-900/50', activeText: 'text-amber-700 dark:text-amber-300' },
  violet: { dot: 'bg-violet-500',  activeBg: 'bg-violet-50 dark:bg-violet-900/50', activeText: 'text-violet-700 dark:text-violet-300' },
  sky:    { dot: 'bg-sky-500',     activeBg: 'bg-sky-50 dark:bg-sky-900/50',     activeText: 'text-sky-700 dark:text-sky-300' },
  pink:   { dot: 'bg-pink-500',    activeBg: 'bg-pink-50 dark:bg-pink-900/50',   activeText: 'text-pink-700 dark:text-pink-300' },
  teal:   { dot: 'bg-teal-500',    activeBg: 'bg-teal-50 dark:bg-teal-900/50',   activeText: 'text-teal-700 dark:text-teal-300' },
  orange: { dot: 'bg-orange-500',  activeBg: 'bg-orange-50 dark:bg-orange-900/50', activeText: 'text-orange-700 dark:text-orange-300' },
  indigo: { dot: 'bg-indigo-500',  activeBg: 'bg-indigo-50 dark:bg-indigo-900/50', activeText: 'text-indigo-700 dark:text-indigo-300' },
  cyan:   { dot: 'bg-cyan-500',    activeBg: 'bg-cyan-50 dark:bg-cyan-900/50',   activeText: 'text-cyan-700 dark:text-cyan-300' },
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
                : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
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
