import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  CheckCircle2,
  Download,
  Hourglass,
  Info,
  Plus,
} from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import useAuth from '../hooks/useAuth';

const MOCK_DATA = [
  {
    compliance: 85,
    nextUpdate: 'Oct 12, 2024',
    advisory: '{name} is missing 1 upcoming booster to reach full seasonal compliance.',
    vaccines: [
      { id: 1, name: 'MMR',         status: 'done',    info: 'Completed • Jun 15, 2023' },
      { id: 2, name: 'Varicella',   status: 'next_up', info: 'Due in 14 days • Oct 12' },
      { id: 3, name: 'Hepatitis A', status: 'done',    info: 'Completed • Jan 20, 2023' },
      { id: 4, name: 'DTP Booster', status: 'pending', info: 'Scheduled • Jan 2025' },
    ],
  },
  {
    compliance: 100,
    nextUpdate: 'Mar 5, 2025',
    advisory: null,
    vaccines: [
      { id: 1, name: 'MMR',         status: 'done',    info: 'Completed • Mar 1, 2022' },
      { id: 2, name: 'Varicella',   status: 'done',    info: 'Completed • Mar 1, 2022' },
      { id: 3, name: 'Hepatitis A', status: 'done',    info: 'Completed • Sep 10, 2023' },
      { id: 4, name: 'DTP Booster', status: 'pending', info: 'Scheduled • Mar 2025' },
    ],
  },
];

const FALLBACK_KIDS = [
  { id: 'k1', name: 'Leo' },
  { id: 'k2', name: 'Maya' },
];

const STATUS_CONFIG = {
  done: {
    Icon: CheckCircle2,
    iconCls: 'bg-emerald-100 text-emerald-500',
    badgeCls: 'bg-emerald-50 text-emerald-700',
    label: 'DONE',
  },
  next_up: {
    Icon: CalendarCheck,
    iconCls: 'bg-brand-100 text-brand-500',
    badgeCls: 'bg-brand-50 text-brand-700',
    label: 'NEXT UP',
  },
  pending: {
    Icon: Hourglass,
    iconCls: 'bg-slate-100 text-slate-400',
    badgeCls: 'bg-slate-100 text-slate-500',
    label: 'PENDING',
  },
};

function VaccineRow({ vaccine }) {
  const { Icon, iconCls, badgeCls, label } = STATUS_CONFIG[vaccine.status];
  return (
    <div className="flex items-center gap-4 py-4">
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${iconCls}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{vaccine.name}</p>
        <p className="mt-0.5 text-xs text-slate-500">{vaccine.info}</p>
      </div>
      <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeCls}`}>
        {label}
      </span>
    </div>
  );
}

export default function VaccinationPage() {
  const navigate = useNavigate();
  const { family } = useAuth();
  const kids = family?.kids?.length ? family.kids : FALLBACK_KIDS;
  const [selectedIdx, setSelectedIdx] = useState(0);

  const data = MOCK_DATA[selectedIdx % MOCK_DATA.length];
  const kidName = kids[selectedIdx]?.name ?? kids[0]?.name;
  const advisoryText = data.advisory?.replace('{name}', kidName) ?? null;

  return (
    <>
      <TopBar
        title="Health Ledger"
        showBell={false}
        onBack={() => navigate('/dashboard')}
      />
      <main className="mx-auto max-w-md space-y-6 px-5 py-6">
        <p className="text-sm text-slate-500">Vaccination tracking for your household</p>

        {/* Member tabs */}
        <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
          {kids.map((kid, idx) => (
            <button
              key={kid.id}
              onClick={() => setSelectedIdx(idx)}
              className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                selectedIdx === idx
                  ? 'bg-white font-semibold text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {kid.name}
            </button>
          ))}
          <button className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-slate-600">
            <Plus size={16} />
          </button>
        </div>

        {/* Compliance card */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Compliance</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{data.compliance}% Complete</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Next update</p>
              <p className="text-xs font-semibold text-slate-700">{data.nextUpdate}</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-brand-500 transition-all duration-500"
              style={{ width: `${data.compliance}%` }}
            />
          </div>
          {advisoryText && (
            <p className="mt-3 text-xs text-slate-500">{advisoryText}</p>
          )}
        </div>

        {/* History & Schedule */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">History &amp; Schedule</h2>
            <button className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50">
              <Download size={13} />
              Download PDF
            </button>
          </div>
          <div className="mt-2 divide-y divide-slate-100 rounded-2xl bg-white px-4 shadow-card">
            {data.vaccines.map((v) => (
              <VaccineRow key={v.id} vaccine={v} />
            ))}
          </div>
        </section>

        {/* Travel Advisory */}
        <div className="flex gap-3 rounded-2xl bg-amber-50 p-4">
          <Info size={18} className="mt-0.5 flex-shrink-0 text-amber-500" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Travel Advisory — </span>
            {kidName}&apos;s records are currently compatible with international travel
            requirements for EU zones.
          </p>
        </div>
      </main>
    </>
  );
}
