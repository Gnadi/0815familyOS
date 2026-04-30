export default function ViewToggle({ value, onChange }) {
  const options = [
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
  ];
  return (
    <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-700">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              active ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-800' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
