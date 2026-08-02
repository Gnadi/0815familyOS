import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Sparkles, Users } from 'lucide-react';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import BrandMark from '../components/brand/BrandMark';
import useAuth from '../hooks/useAuth';
import useT from '../hooks/useT';
import { joinFamilyByToken } from '../services/families';
import { isExpired, readInvite } from '../services/invites';
import { isValidInviteToken, normalizeInviteToken } from '../utils/inviteToken';
import { joinErrorMessage } from '../utils/inviteErrors';
import { exitDemo, isDemoMode } from '../lib/demoMode';

// Landing point for an invite link. Sits outside FamilyGate on purpose: it has
// to render for signed-out visitors, and FamilyGate would bounce a user
// without a family straight to /family-setup before they ever saw the invite.

function Shell({ children }) {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-5 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <BrandMark className="h-9 w-9 rounded-lg" />
          <span className="text-lg font-bold text-slate-900">myFAOS</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Card({ title, children, tone = 'default' }) {
  const ring = tone === 'error' ? 'border border-red-100' : '';
  return (
    <div className={`rounded-2xl bg-white p-6 shadow-card ${ring}`}>
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <div className="mt-2 space-y-4 text-sm text-slate-600">{children}</div>
    </div>
  );
}

export default function JoinPage() {
  const { token: rawToken } = useParams();
  const token = normalizeInviteToken(rawToken);
  const { user, userDoc, loading } = useAuth();
  const { t } = useT();
  const location = useLocation();
  const navigate = useNavigate();

  const [invite, setInvite] = useState(null);
  const [lookupDone, setLookupDone] = useState(false);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  const demo = isDemoMode();
  const validShape = isValidInviteToken(token);

  useEffect(() => {
    if (demo || !user || !validShape) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const found = await readInvite(token);
        if (!cancelled) setInvite(found);
      } catch {
        if (!cancelled) setInvite(null);
      } finally {
        if (!cancelled) setLookupDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, user, token, validShape]);

  // Demo: do NOT silently hard-navigate out the way LoginPage does. That would
  // bypass the explicit demo guards in services/families.js and yank the
  // visitor out of the demo without asking. The token survives the exit
  // because it is a path segment — exitDemo preserves pathname only.
  if (demo) {
    return (
      <Shell>
        <Card title={t('invite.demoTitle')}>
          <p className="flex items-start gap-2">
            <Sparkles size={16} className="mt-0.5 flex-shrink-0 text-brand-500" />
            {t('invite.demoHint')}
          </p>
          <Button className="w-full" onClick={() => exitDemo(location.pathname)}>
            {t('invite.demoLeave')}
          </Button>
        </Card>
      </Shell>
    );
  }

  if (!validShape) {
    return (
      <Shell>
        <Card title={t('invite.errInvalidLink')} tone="error">
          <p>{t('invite.errInvalidLinkHint')}</p>
          <Link to="/" className="inline-block font-semibold text-brand-600">
            {t('invite.goHome')}
          </Link>
        </Card>
      </Shell>
    );
  }

  if (loading) return <Spinner fullscreen />;

  // Signed out. The family name cannot be shown yet — reading an invite
  // requires an authenticated caller.
  if (!user) {
    return (
      <Shell>
        <Card title={t('invite.signedOutTitle')}>
          <p>{t('invite.signedOutHint')}</p>
          <div className="flex flex-col gap-2 pt-1">
            <Link to="/signup" state={{ from: location }}>
              <Button className="w-full">{t('invite.createAccount')}</Button>
            </Link>
            <Link to="/login" state={{ from: location }}>
              <Button variant="secondary" className="w-full">
                {t('invite.signIn')}
              </Button>
            </Link>
          </div>
        </Card>
      </Shell>
    );
  }

  if (!lookupDone) return <Spinner fullscreen />;

  if (!invite || invite.revoked || isExpired(invite)) {
    const key = !invite
      ? 'invite.errNotFound'
      : invite.revoked
        ? 'invite.errRevoked'
        : 'invite.errExpired';
    return (
      <Shell>
        <Card title={t(key)} tone="error">
          <p>{t('invite.errAskForNew')}</p>
          <Link
            to={userDoc?.familyId ? '/dashboard' : '/family-setup'}
            className="inline-block font-semibold text-brand-600"
          >
            {userDoc?.familyId ? t('invite.goToDashboard') : t('invite.setUpFamily')}
          </Link>
        </Card>
      </Shell>
    );
  }

  if (userDoc?.familyId && userDoc.familyId === invite.familyId) {
    return <Navigate to="/dashboard" replace />;
  }

  // Already in a different family. An explanation, not a silent bounce — the
  // user clicked a link and deserves to know why nothing happened.
  if (userDoc?.familyId) {
    return (
      <Shell>
        <Card title={t('invite.alreadyInOtherFamily')}>
          <p>{t('invite.alreadyInOtherFamilyHint', { family: invite.familyName })}</p>
          <Link to="/dashboard" className="inline-block font-semibold text-brand-600">
            {t('invite.goToDashboard')}
          </Link>
        </Card>
      </Shell>
    );
  }

  async function handleJoin() {
    setError('');
    setJoining(true);
    try {
      await joinFamilyByToken({ token, uid: user.uid });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(joinErrorMessage(err, t));
    } finally {
      setJoining(false);
    }
  }

  return (
    <Shell>
      <Card title={t('invite.joinTitle', { family: invite.familyName })}>
        {invite.createdByName && (
          <p className="flex items-center gap-2">
            <Users size={16} className="flex-shrink-0 text-slate-400" />
            {t('invite.joinInvitedBy', { name: invite.createdByName })}
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" onClick={handleJoin} loading={joining}>
          {t('invite.joinButton')}
        </Button>
      </Card>
    </Shell>
  );
}
