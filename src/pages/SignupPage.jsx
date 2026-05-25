import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import useAuth from '../hooks/useAuth';
import { signUpWithEmail, signInWithGoogle, signInWithApple, toFriendlyError } from '../services/auth';
import { isIOS } from '../lib/platform';

export default function SignupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  if (user) return <Navigate to="/family-setup" replace />;

  function validate() {
    if (!displayName.trim()) return 'Please enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(email)) return 'Please enter a valid email.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const v = validate();
    if (v) return setError(v);
    setError('');
    setLoading(true);
    try {
      await signUpWithEmail({ email, password, displayName });
      navigate('/family-setup', { replace: true });
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      navigate('/family-setup', { replace: true });
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleApple() {
    setError('');
    setAppleLoading(true);
    try {
      await signInWithApple();
      navigate('/family-setup', { replace: true });
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setAppleLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 px-5 py-10">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">Start organizing your family life today.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="Your name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Sarah"
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">
            Create account
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          OR
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <Button variant="secondary" onClick={handleGoogle} loading={googleLoading} className="w-full">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 8 3l5.7-5.7C33.8 6.1 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 8 3l5.7-5.7C33.8 6.1 29.2 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.7 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.2-.1-2.3-.4-3.5z"/>
          </svg>
          Continue with Google
        </Button>

        {isIOS && (
          <Button
            variant="secondary"
            onClick={handleApple}
            loading={appleLoading}
            className="mt-3 w-full bg-black text-white hover:bg-black/90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="currentColor">
              <path d="M16.365 1.43c0 1.14-.41 2.12-1.23 2.94-.99.99-2.18 1.56-3.47 1.46-.04-1.1.43-2.16 1.23-2.94.84-.82 2.13-1.4 3.47-1.46zm4.06 17.06c-.55 1.27-1.21 2.46-2.13 3.42-.83.88-1.66 1.45-2.78 1.47-1.05.02-1.4-.62-2.86-.62-1.46 0-1.84.6-2.85.64-1.12.04-1.97-.66-2.82-1.54C5.51 19.4 3.5 14.78 5.74 11.6c1.11-1.56 2.94-2.55 4.88-2.58 1.07-.02 2.07.72 2.73.72.65 0 1.91-.89 3.21-.76.55.02 2.1.22 3.09 1.7-.08.05-1.86 1.09-1.84 3.25.02 2.6 2.28 3.46 2.31 3.47-.02.06-.36 1.23-1.19 2.44z"/>
            </svg>
            Sign up with Apple
          </Button>
        )}

        <p className="mt-8 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
