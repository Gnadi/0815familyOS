import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import useAuth from '../hooks/useAuth';
import useT from '../hooks/useT';
import { requestPasswordReset, toFriendlyError } from '../services/auth';
import { exitDemo, isDemoMode } from '../lib/demoMode';

export default function ForgotPasswordPage() {
  const { user } = useAuth();
  const { t, locale } = useT();
  const location = useLocation();
  // LoginPage hands over what was already typed, plus the original
  // destination (e.g. an invite link) so "back to sign in" keeps it.
  const from = location.state?.from;
  const [email, setEmail] = useState(location.state?.email || '');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Same as LoginPage: a hand-typed URL while in the demo leaves the demo.
  if (isDemoMode()) {
    exitDemo(window.location.pathname);
    return null;
  }
  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) return setError(t('auth.errEmailInvalid'));
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset({ email: address, locale });
      setSentTo(address);
    } catch (err) {
      setError(toFriendlyError(err, t));
    } finally {
      setLoading(false);
    }
  }

  const backLink = (
    <p className="mt-8 text-center text-sm text-slate-500">
      <Link to="/login" state={{ from }} className="font-semibold text-brand-600">
        {t('auth.backToSignIn')}
      </Link>
    </p>
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 px-5 py-10">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        {sentTo ? (
          <>
            <h1 className="text-2xl font-bold text-slate-900">{t('auth.resetSentTitle')}</h1>
            {/* Deliberately neutral: Firebase's email enumeration protection
                doesn't reveal whether the address has an account. */}
            <p className="mt-2 text-sm text-slate-600">{t('auth.resetSent', { email: sentTo })}</p>
            <p className="mt-3 text-sm text-slate-500">{t('auth.resetGoogleHint')}</p>
            <Button
              variant="secondary"
              onClick={() => setSentTo('')}
              className="mt-6 w-full"
            >
              {t('auth.resendResetLink')}
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-900">{t('auth.resetTitle')}</h1>
            <p className="mt-1 text-sm text-slate-500">{t('auth.resetSubtitle')}</p>

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
              <Input
                label={t('auth.email')}
                type="email"
                autoComplete="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" loading={loading} className="w-full">
                {t('auth.sendResetLink')}
              </Button>
            </form>
          </>
        )}
        {backLink}
      </div>
    </div>
  );
}
