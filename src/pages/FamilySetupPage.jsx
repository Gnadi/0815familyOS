import { useState } from 'react';
import { ArrowLeft, Key, Plus } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Spinner from '../components/common/Spinner';
import useAuth from '../hooks/useAuth';
import useT from '../hooks/useT';
import { createFamily, joinFamilyByToken } from '../services/families';
import { looksLikeLegacyCode, normalizeInviteToken } from '../utils/inviteToken';
import { joinErrorMessage } from '../utils/inviteErrors';
import InviteShareCard from '../components/invites/InviteShareCard';
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
  const [createdInvite, setCreatedInvite] = useState(null);

  if (loading) return <Spinner fullscreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (userDoc?.familyId && !createdInvite) return <Navigate to="/dashboard" replace />;

  async function handleCreate(e) {
    e.preventDefault();
    if (!familyName.trim()) return setError(t('familySetup.errNameRequired'));
    setError('');
    setBusy(true);
    try {
      await ensureUserDoc(user);
      const invite = await createFamily({
        name: familyName,
        uid: user.uid,
        displayName: userDoc?.displayName || user.displayName || '',
        locale,
      });
      setCreatedInvite(invite);
    } catch (err) {
      setError(err.message || t('familySetup.errCreateFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    // The old 6-character codes stopped working when invite tokens landed;
    // say so instead of reporting a generic "not found".
    if (looksLikeLegacyCode(joinCode)) return setError(t('familySetup.errLegacyCode'));
    const token = normalizeInviteToken(joinCode);
    if (!token) return setError(t('familySetup.errTokenRequired'));
    setError('');
    setBusy(true);
    try {
      await ensureUserDoc(user);
      await joinFamilyByToken({ token, uid: user.uid });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(joinErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  if (createdInvite) {
    return (
      <div className="min-h-screen bg-slate-50 px-5 py-8">
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-bold text-slate-900">{t('familySetup.readyTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('familySetup.readySubtitle')}
          </p>

          <div className="mt-6 rounded-2xl bg-white p-5 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              {t('familySetup.inviteLink')}
            </p>
            <div className="mt-2">
              <InviteShareCard compact />
            </div>
            <p className="mt-3 text-xs text-slate-400">
              {t('familySetup.inviteLinkHint')}
            </p>
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
            <h2 className="text-lg font-semibold text-slate-900">{t('familySetup.enterInviteLink')}</h2>
            <Input
              label={t('familySetup.inviteLinkLabel')}
              placeholder="https://myfaos.app/join/…"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              maxLength={200}
              className="font-mono text-sm"
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
