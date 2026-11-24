import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { format } from 'date-fns';
import { formatDate } from '../utils/date';
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
import useT from '../hooks/useT';
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
    labelKey: 'health.statusDone',
    infoKey: 'health.infoCompleted',
  },
  next_up: {
    Icon: CalendarCheck,
    iconCls: 'bg-brand-100 text-brand-500',
    badgeCls: 'bg-brand-50 text-brand-700',
    labelKey: 'health.statusNextUp',
    infoKey: 'health.infoDue',
  },
  pending: {
    Icon: Hourglass,
    iconCls: 'bg-slate-100 text-slate-400',
    badgeCls: 'bg-slate-100 text-slate-500',
    labelKey: 'health.statusPending',
    infoKey: 'health.infoScheduled',
  },
};

function fmtDate(date) {
  if (!date) return '';
  return formatDate(date instanceof Date ? date : new Date(date), 'withYear');
}

function toIso(date) {
  if (!date) return format(new Date(), 'yyyy-MM-dd');
  return format(date instanceof Date ? date : new Date(date), 'yyyy-MM-dd');
}

function VaccineRow({ vaccine, onClick, t }) {
  const cfg = STATUS_CONFIG[vaccine.status];
  const { Icon, iconCls, badgeCls } = cfg;
  return (
    <button
      type="button"
      onClick={() => onClick(vaccine)}
      className="-mx-5 flex w-[calc(100%+2.5rem)] items-center gap-4 px-5 py-5 text-left transition-colors hover:bg-slate-50"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconCls}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{vaccine.name}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {t(cfg.infoKey)} • {fmtDate(vaccine.date)}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeCls}`}>
        {t(cfg.labelKey)}
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
  const { t, tn } = useT();

  const kids = family?.kids ?? [];
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Removing a child in Settings shrinks the list under us; without this the
  // selected tab can point past the end and every read of `currentKid` below
  // (including the "+" handler) would hit null.
  useEffect(() => {
    if (selectedIdx > 0 && selectedIdx >= kids.length) setSelectedIdx(0);
  }, [kids.length, selectedIdx]);

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
      ? tn('health.advisoryMissing', nextUpCount, { name: currentKid?.name })
      : null;

  function openEdit(vaccine) {
    setEditingVaccine({ ...vaccine, date: toIso(vaccine.date) });
    setModalOpen(true);
  }

  async function handleSubmit(values) {
    if (editingVaccine?.id) {
      await updateVaccination(editingVaccine.id, values);
    } else {
      if (!currentKid) throw new Error(t('health.noKids'));
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
        <TopBar title={t('health.title')} onBack={() => navigate('/dashboard')} />
        <main className="mx-auto max-w-md px-5 py-16 text-center">
          <p className="text-2xl">💉</p>
          <p className="mt-3 text-base font-semibold text-slate-900">{t('health.noKids')}</p>
          <p className="mt-1 text-sm text-slate-500">
            {t('health.noKidsDesc')}
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title={t('health.title')} onBack={() => navigate('/dashboard')} />
      <main className="mx-auto max-w-md space-y-6 px-5 py-6">
        <p className="text-sm text-slate-500">{t('health.subtitle')}</p>

        {/* Member tabs — no + button, kids are managed in Settings */}
        <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
          {kids.map((kid, idx) => (
            <button
              key={kid.id}
              onClick={() => setSelectedIdx(idx)}
              className={`flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                selectedIdx === idx
                  ? 'bg-white font-semibold text-slate-900 shadow-xs'
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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('health.compliance')}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{t('health.percentComplete', { pct: compliance })}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">{t('health.nextUpdate')}</p>
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
            <h2 className="text-base font-bold text-slate-900">{t('health.historySchedule')}</h2>
            <button
              onClick={async () => {
                const { buildPdf } = await import('./vaccinationPdf');
                buildPdf({
                  kidName: currentKid?.name ?? '',
                  compliance,
                  nextUpdateDate,
                  kidVaccines,
                  t,
                  statusConfig: STATUS_CONFIG,
                });
              }}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
            >
              <Download size={13} />
              {t('health.downloadPdf')}
            </button>
          </div>
          <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white px-5 shadow-card">
            {loading ? (
              <Spinner />
            ) : kidVaccines.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                {t('health.noVaccines')}
              </p>
            ) : (
              kidVaccines.map((v) => (
                <VaccineRow key={v.id} vaccine={v} onClick={openEdit} t={t} />
              ))
            )}
          </div>
        </section>

        {/* Travel Advisory */}
        {currentKid && (
          <div className="flex gap-3 rounded-2xl bg-amber-50 p-4">
            <Info size={18} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">{t('health.travelAdvisory')} — </span>
              {t('health.travelAdvisoryText', { name: currentKid.name })}
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
