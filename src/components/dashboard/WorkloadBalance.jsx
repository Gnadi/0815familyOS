export default function WorkloadBalance() {
  // Static mock per MVP spec.
  const left = { name: 'You', value: 52 };
  const right = { name: 'Partner', value: 48 };

  return (
    <section>
      <h2 className="text-lg font-bold text-slate-900">Workload Balance</h2>
      <div className="mt-3 rounded-2xl bg-white p-5 shadow-card">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-slate-500">{left.name}</p>
            <p className="text-2xl font-bold text-brand-500">{left.value}%</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">{right.name}</p>
            <p className="text-2xl font-bold text-slate-400">{right.value}%</p>
          </div>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-500"
            style={{ width: `${left.value}%` }}
          />
        </div>
        <p className="mt-2 text-center text-xs text-slate-400">Looking balanced this week!</p>
      </div>
    </section>
  );
}
