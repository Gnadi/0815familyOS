import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import {
  CalendarCheck,
  CheckCircle2,
  Download,
  Hourglass,
  Info,
} from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import VaccinationFormModal from '../components/health/VaccinationFormModal';
import useAuth from '../hooks/useAuth';
import useVaccinations from '../hooks/useVaccinations';
import {
  createVaccination,
  updateVaccination,
  deleteVaccination,
} from '../services/vaccinations';

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

const PDF_STATUS_COLORS = {
  done:    { r: 16,  g: 185, b: 129 },
  next_up: { r: 59,  g: 130, b: 246 },
  pending: { r: 148, g: 163, b: 184 },
};

function fmtDate(date) {
  if (!date) return '';
  return format(date instanceof Date ? date : new Date(date), 'MMM d, yyyy');
}

function toIso(date) {
  if (!date) return format(new Date(), 'yyyy-MM-dd');
  return format(date instanceof Date ? date : new Date(date), 'yyyy-MM-dd');
}

function buildPdf({ kidName, compliance, nextUpdateDate, kidVaccines }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 20;
  const contentW = W - 2 * margin;
  let y = 0;

  // Blue header band
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, W, 38, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Health Ledger', margin, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Vaccination Record — ${kidName}`, margin, 27);
  doc.text(`Generated ${format(new Date(), 'MMM d, yyyy')}`, W - margin, 27, { align: 'right' });

  y = 52;

  // Compliance row
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('COMPLIANCE', margin, y);
  doc.text('Next update', W - margin, y, { align: 'right' });

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(`${compliance}% Complete`, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(nextUpdateDate, W - margin, y, { align: 'right' });

  y += 7;

  // Progress bar
  doc.setFillColor(226, 232, 240);
  doc.roundedRect(margin, y, contentW, 4, 2, 2, 'F');
  if (compliance > 0) {
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(margin, y, contentW * compliance / 100, 4, 2, 2, 'F');
  }

  y += 16;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, y, W - margin, y);

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('History & Schedule', margin, y);

  y += 10;

  if (kidVaccines.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('No vaccinations recorded yet.', margin, y);
  } else {
    kidVaccines.forEach((v, i) => {
      if (y > 268) { doc.addPage(); y = 20; }
      const c = PDF_STATUS_COLORS[v.status];
      const { label, infoPrefix } = STATUS_CONFIG[v.status];

      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin - 4, y - 5, contentW + 8, 15, 'F');
      }
      doc.setFillColor(c.r, c.g, c.b);
      doc.circle(margin + 3, y + 2.5, 2.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(v.name, margin + 10, y + 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${infoPrefix} • ${fmtDate(v.date)}`, margin + 10, y + 9);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(c.r, c.g, c.b);
      doc.text(label, W - margin, y + 4, { align: 'right' });

      y += 15;
    });
  }

  y += 8;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, W - margin, y);
  y += 10;

  // Travel advisory box
  doc.setFillColor(255, 251, 235);
  doc.roundedRect(margin, y, contentW, 18, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(146, 64, 14);
  doc.text('Travel Advisory', margin + 5, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${kidName}'s records are compatible with EU international travel requirements.`,
    margin + 5, y + 13,
  );

  // Footer
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Generated by FamilyOS · Health Ledger', margin, 288);
  doc.text(format(new Date(), 'PPP'), W - margin, 288, { align: 'right' });

  doc.save(`health-ledger-${kidName.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

function VaccineRow({ vaccine, onClick }) {
  const cfg = STATUS_CONFIG[vaccine.status];
  const { Icon, iconCls, badgeCls, label, infoPrefix } = cfg;
  return (
    <button
      type="button"
      onClick={() => onClick(vaccine)}
      className="-mx-5 flex w-[calc(100%+2.5rem)] items-center gap-4 px-5 py-5 text-left transition-colors hover:bg-slate-50"
    >
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${iconCls}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{vaccine.name}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {infoPrefix} • {fmtDate(vaccine.date)}
        </p>
      </div>
      <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeCls}`}>
        {label}
      </span>
    </button>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500" />
    </div>
  );
}

export default function VaccinationPage() {
  const navigate = useNavigate();
  const { setHealthFabCallback } = useOutletContext();
  const { user, userDoc, family } = useAuth();

  const kids = family?.kids ?? [];
  const [selectedIdx, setSelectedIdx] = useState(0);

  const { vaccinations, loading } = useVaccinations(userDoc?.familyId);

  const [modalOpen, setModalOpen]           = useState(false);
  const [editingVaccine, setEditingVaccine] = useState(null);

  useEffect(() => {
    setHealthFabCallback(() => () => {
      setEditingVaccine(null);
      setModalOpen(true);
    });
    return () => setHealthFabCallback(null);
  }, [setHealthFabCallback]);

  const currentKid  = kids[selectedIdx] ?? null;
  const kidVaccines = currentKid
    ? vaccinations.filter((v) => v.kidId === currentKid.id)
    : [];

  const total       = kidVaccines.length;
  const doneCount   = kidVaccines.filter((v) => v.status === 'done').length;
  const compliance  = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const nextUpCount = kidVaccines.filter((v) => v.status === 'next_up').length;

  const upcoming = kidVaccines
    .filter((v) => v.status !== 'done' && v.date)
    .sort((a, b) => a.date - b.date);
  const nextUpdateDate = upcoming[0]?.date ? fmtDate(upcoming[0].date) : '—';

  const advisoryText =
    nextUpCount > 0
      ? `${currentKid?.name} is missing ${nextUpCount} upcoming booster${nextUpCount > 1 ? 's' : ''} to reach full seasonal compliance.`
      : null;

  function openEdit(vaccine) {
    setEditingVaccine({ ...vaccine, date: toIso(vaccine.date) });
    setModalOpen(true);
  }

  async function handleSubmit(values) {
    if (editingVaccine?.id) {
      await updateVaccination(editingVaccine.id, values);
    } else {
      await createVaccination({
        familyId: userDoc.familyId,
        userId: user.uid,
        kidId: currentKid.id,
        ...values,
      });
    }
    setModalOpen(false);
    setEditingVaccine(null);
  }

  async function handleDelete() {
    await deleteVaccination(editingVaccine.id);
    setModalOpen(false);
    setEditingVaccine(null);
  }

  if (!loading && kids.length === 0) {
    return (
      <>
        <TopBar title="Health Ledger" showBell={false} onBack={() => navigate('/dashboard')} />
        <main className="mx-auto max-w-md px-5 py-16 text-center">
          <p className="text-2xl">💉</p>
          <p className="mt-3 text-base font-semibold text-slate-900">No children added yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Go to Settings → Family to add your children before tracking vaccinations.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title="Health Ledger" showBell={false} onBack={() => navigate('/dashboard')} />
      <main className="mx-auto max-w-md space-y-6 px-5 py-6">
        <p className="text-sm text-slate-500">Vaccination tracking for your household</p>

        {/* Member tabs — no + button, kids are managed in Settings */}
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
        </div>

        {/* Compliance card */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Compliance</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{compliance}% Complete</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Next update</p>
              <p className="text-xs font-semibold text-slate-700">{nextUpdateDate}</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-brand-500 transition-all duration-500"
              style={{ width: `${compliance}%` }}
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
            <button
              onClick={() =>
                buildPdf({ kidName: currentKid?.name ?? '', compliance, nextUpdateDate, kidVaccines })
              }
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
            >
              <Download size={13} />
              Download PDF
            </button>
          </div>
          <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white px-5 shadow-card">
            {loading ? (
              <Spinner />
            ) : kidVaccines.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                No vaccinations yet. Tap + to add the first one.
              </p>
            ) : (
              kidVaccines.map((v) => (
                <VaccineRow key={v.id} vaccine={v} onClick={openEdit} />
              ))
            )}
          </div>
        </section>

        {/* Travel Advisory */}
        {currentKid && (
          <div className="flex gap-3 rounded-2xl bg-amber-50 p-4">
            <Info size={18} className="mt-0.5 flex-shrink-0 text-amber-500" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Travel Advisory — </span>
              {currentKid.name}&apos;s records are currently compatible with international
              travel requirements for EU zones.
            </p>
          </div>
        )}
      </main>

      <VaccinationFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingVaccine(null); }}
        onSubmit={handleSubmit}
        onDelete={editingVaccine?.id ? handleDelete : undefined}
        initial={editingVaccine}
      />
    </>
  );
}
