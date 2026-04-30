import { Link } from 'react-router-dom';
import { FileText, Gift, Syringe } from 'lucide-react';

function Tile({ icon: Icon, label, bg, color, to }) {
  const className = `flex flex-1 flex-col items-start gap-3 rounded-2xl p-5 text-left ${bg}`;
  const inner = (
    <>
      <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-white ${color}`}>
        <Icon size={18} />
      </div>
      <span className="text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className={className}>{inner}</Link>
  ) : (
    <button className={className}>{inner}</button>
  );
}

export default function QuickAccess() {
  return (
    <section>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Quick Access</h2>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Tile icon={FileText} label="Document Vault" bg="bg-emerald-50" color="text-emerald-600" to="/vault" />
        <Tile icon={Gift}     label="Gift Planner"   bg="bg-violet-50"  color="text-violet-600"  to="/gifts" />
        <Tile icon={Syringe}  label="Health Ledger"  bg="bg-red-50"     color="text-red-500"     to="/health" />
      </div>
    </section>
  );
}
