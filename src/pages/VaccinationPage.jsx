import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { format } from 'date-fns';
import {
  CalendarCheck,
  CheckCircle2,
  Download,
  Hourglass,
  Info,
  Plus,
} from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import VaccinationFormModal from '../components/health/VaccinationFormModal';
import useAuth from '../hooks/useAuth';

// Initial mock data — uses ISO dates so the form can pre-fill properly
const INITIAL_DATA = [
  {
    compliance: 85,
    nextUpdate: 'Oct 12, 2024',
    advisory: '{name} is missing 1 upcoming booster to reach full seasonal compliance.',
    vaccines: [
      { id: 1, name: 'MMR',         status: 'done',    date: '2023-06-15' },
      { id: 2, name: 'Varicella',   status: 'next_up', date: '2024-10-12' },
      { id: 3, name: 'Hepatitis A', status: 'done',    date: '2023-01-20' },
      { id: 4, name: 'DTP Booster', status: 'pending', date: '2025-01-01' },
    ],
  },
  {
    compliance: 100,
    nextUpdate: 'Mar 5, 2025',
    advisory: null,
    vaccines: [
      { id: 1, name: 'MMR',         status: 'done',    date: '2022-03-01' },
      { id: 2, name: 'Varicella',   status: 'done',    date: '2022-03-01' },
      { id: 3, name: 'Hepatitis A', status: 'done',    date: '2023-09-10' },
      { id: 4, name: 'DTP Booster', status: 'pending', date: '2025-03-01' },
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
    infoPrefix: 'Completed',
  },
  next_up: {
    Icon: CalendarCheck,
    iconCls: 'bg-brand-100 text-brand-500',
    badgeCls: 'bg-brand-50 text-brand-700',
    label: 'NEXT UP',
    infoPrefix: 'Due',
  },
  pending: {
    Icon: Hourglass,
    iconCls: 'bg-slate-100 text-slate-400',
    badgeCls: 'bg-slate-100 text-slate-500',
    label: 'PENDING',
    infoPrefix: 'Scheduled',
  },
};

function fmtDate(isoStr) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-').map(Number);
  return format(new Date(y, m - 1, d), 'MMM d, yyyy');
}

function VaccineRow({ vaccine, onClick }) {
  const { Icon, iconCls, badgeCls, label, infoPrefix } = STATUS_CONFIG[vaccine.status];
  const info = `${infoPrefix} • ${fmtDate(vaccine.date)}`;
  return (
    <button
      type="button"
      onClick={() => onClick(vaccine)}
      className="flex w-full items-center gap-4 py-4 text-left hover:bg-slate-50 -mx-4 px-4 transition-colors"
    >
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${iconCls}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{vaccine.name}</p>
        <p className="mt-0.5 text-xs text-slate-500">{info}</p>
      </div>
      <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeCls}`}>
        {label}
      </span>
    </button>
  );
}

export default function VaccinationPage() {
  const navigate = useNavigate();
  const { setHealthFabCallback } = useOutletContext();
  const { family } = useAuth();

  const kids = family?.kids?.length ? family.kids : FALLBACK_KIDS;
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Per-slot vaccine lists (wraps at INITIAL_DATA.length for mock slots)
  const [vaccinesBySlot, setVaccinesBySlot] = useState(
    () => INITIAL_DATA.map((d) => [...d.vaccines])
  );

  const [modalOpen, setModalOpen]         = useState(false);
  const [editingVaccine, setEditingVaccine] = useState(null);

  const slotIdx   = selectedIdx % vaccinesBySlot.length;
  const vaccines  = vaccinesBySlot[slotIdx];
  const slotMeta  = INITIAL_DATA[slotIdx];
  const kidName   = kids[selectedIdx]?.name ?? kids[0]?.name ?? '';
  const advisoryText = slotMeta.advisory?.replace('{name}', kidName) ?? null;

  // Register the FAB handler with AppShell while this page is mounted
  useEffect(() => {
    setHealthFabCallback(() => () => {
      setEditingVaccine(null);
      setModalOpen(true);
    });
    return () => setHealthFabCallback(null);
  }, [setHealthFabCallback]);

  function openEdit(vaccine) {
    setEditingVaccine(vaccine);
    setModalOpen(true);
  }

  function handleSubmit(values) {
    if (editingVaccine) {
      // Update existing
      setVaccinesBySlot((prev) => {
        const next = prev.map((list, i) =>
          i === slotIdx
            ? list.map((v) => (v.id === editingVaccine.id ? { ...v, ...values } : v))
            : list
        );
        return next;
      });
    } else {
      // Add new
      const newVaccine = { id: Date.now(), ...values };
      setVaccinesBySlot((prev) => {
        const next = [...prev];
        next[slotIdx] = [...next[slotIdx], newVaccine];
        return next;
      });
    }
    setModalOpen(false);
    setEditingVaccine(null);
  }

  function handleDelete() {
    setVaccinesBySlot((prev) => {
      const next = [...prev];
      next[slotIdx] = next[slotIdx].filter((v) => v.id !== editingVaccine.id);
      return next;
    });
    setModalOpen(false);
    setEditingVaccine(null);
  }

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
              <p className="mt-1 text-2xl font-bold text-slate-900">{slotMeta.compliance}% Complete</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Next update</p>
              <p className="text-xs font-semibold text-slate-700">{slotMeta.nextUpdate}</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-brand-500 transition-all duration-500"
              style={{ width: `${slotMeta.compliance}%` }}
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
          <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-card">
            {vaccines.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                No vaccinations yet. Tap + to add one.
              </p>
            ) : (
              vaccines.map((v) => (
                <VaccineRow key={v.id} vaccine={v} onClick={openEdit} />
              ))
            )}
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

      <VaccinationFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingVaccine(null); }}
        onSubmit={handleSubmit}
        onDelete={editingVaccine ? handleDelete : undefined}
        initial={editingVaccine}
      />
    </>
  );
}
