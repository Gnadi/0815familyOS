import { useState } from 'react';
import { ArrowLeft, Copy, Key, Plus, User } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Spinner from '../components/common/Spinner';
import useAuth from '../hooks/useAuth';
import useT from '../hooks/useT';
import { createFamily, joinFamilyByCode } from '../services/families';
import { signOut } from '../services/auth';
import { ensureUserDoc } from '../services/users';

function ModeCard({ icon: Icon, title, description, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl bg-white p-5 text-left shadow-card transition hover:bg-slate-50"
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <Icon size={24} />
      </div>
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
    </button>
  );
}

export default function FamilySetupPage() {
  const { user, userDoc, loading } = useAuth();
  const { t, locale } = useT();
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // 'create' | 'join' | null
  const [familyName, setFamilyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [createdCode, setCreatedCode] = useState('');

  if (loading) return <Spinner fullscreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (userDoc?.familyId && !createdCode) return <Navigate to="/dashboard" replace />;

  async function handleCreate(e) {
    e.preventDefault();
    if (!familyName.trim()) return setError(t('familySetup.errNameRequired'));
    setError('');
    setBusy(true);
    try {
      await ensureUserDoc(user);
      const { inviteCode } = await createFamily({ name: familyName, uid: user.uid, locale });
      setCreatedCode(inviteCode);
    } catch (err) {
      setError(err.message || t('familySetup.errCreateFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (joinCode.trim().length < 4) return setError(t('familySetup.errCodeShort'));
    setError('');
    setBusy(true);
    try {
      await ensureUserDoc(user);
      await joinFamilyByCode({ code: joinCode, uid: user.uid });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || t('familySetup.errJoinFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (createdCode) {
    return (
      <div className="min-h-screen bg-slate-50 px-5 py-8">
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-bold text-slate-900">{t('familySetup.readyTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('familySetup.readySubtitle')}
          </p>

          <div className="mt-6 rounded-2xl bg-white p-6 text-center shadow-card">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              {t('familySetup.inviteCode')}
            </p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-[0.3em] text-slate-900">
              {createdCode}
            </p>
            <button
              onClick={() => navigator.clipboard?.writeText(createdCode)}
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              <Copy size={14} /> {t('familySetup.copyCode')}
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">{t('familySetup.inviteMembers')}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {t('familySetup.inviteMembersHint')}
            </p>
            <div className="mt-3 space-y-2 opacity-60">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                  <User size={16} />
                </div>
                <span className="text-sm text-slate-600">name@example.com</span>
              </div>
            </div>
          </div>

          <Button onClick={() => navigate('/dashboard', { replace: true })} className="mt-8 w-full">
            {t('familySetup.continueToDashboard')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
        <button
          onClick={mode ? () => { setMode(null); setError(''); } : () => signOut()}
          className="text-slate-600 hover:text-slate-900"
          aria-label={t('common.back')}
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-bold text-slate-900">{t('familySetup.title')}</h1>
        <div className="w-6" />
      </header>

      <main className="mx-auto max-w-md px-5 py-6">
        {!mode && (
          <div className="space-y-4">
            <ModeCard
              icon={Plus}
              title={t('familySetup.createTitle')}
              description={t('familySetup.createDesc')}
              onClick={() => setMode('create')}
            />
            <ModeCard
              icon={Key}
              title={t('familySetup.joinTitle')}
              description={t('familySetup.joinDesc')}
              onClick={() => setMode('join')}
            />
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4 rounded-2xl bg-white p-5 shadow-card">
            <h2 className="text-lg font-semibold text-slate-900">{t('familySetup.nameYourFamily')}</h2>
            <Input
              label={t('familySetup.familyName')}
              placeholder={t('familySetup.familyNamePlaceholder')}
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              autoFocus
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" loading={busy} className="w-full">
              {t('familySetup.createFamily')}
            </Button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4 rounded-2xl bg-white p-5 shadow-card">
            <h2 className="text-lg font-semibold text-slate-900">{t('familySetup.enterInviteCode')}</h2>
            <Input
              label={t('familySetup.inviteCodeLabel')}
              placeholder="ABC123"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={8}
              className="font-mono tracking-[0.3em] uppercase"
              autoFocus
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" loading={busy} className="w-full">
              {t('familySetup.joinFamily')}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
