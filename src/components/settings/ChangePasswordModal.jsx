import { useState } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import useT from '../../hooks/useT';
import { changePassword, requestPasswordReset, toFriendlyError } from '../../services/auth';

// Change-password sheet for email/password accounts. "Forgot password?" sends
// the same reset email as the login page, for anyone who no longer knows the
// current password the change requires.
export default function ChangePasswordModal({ open, onClose, email }) {
  const { t, locale } = useT();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  function close() {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError('');
    setNotice('');
    onClose();
  }

  function validate() {
    if (next.length < 6) return t('auth.errPasswordShort');
    if (next !== confirm) return t('settings.errPasswordMismatch');
    if (next === current) return t('settings.errPasswordUnchanged');
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const v = validate();
    if (v) return setError(v);
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setConfirm('');
      setNotice(t('settings.passwordChanged'));
    } catch (err) {
      setError(toFriendlyError(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot() {
    setError('');
    setNotice('');
    setResetBusy(true);
    try {
      await requestPasswordReset({ email, locale });
      setNotice(t('settings.resetLinkSent', { email }));
    } catch (err) {
      setError(toFriendlyError(err, t));
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title={t('settings.changePassword')}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Lets password managers attach the new password to this account. */}
        <input type="email" value={email || ''} autoComplete="username" readOnly hidden />
        <div>
          <Input
            label={t('settings.currentPassword')}
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <div className="mt-1.5 text-right">
            <button
              type="button"
              onClick={handleForgot}
              disabled={resetBusy}
              className="text-sm font-medium text-brand-600 disabled:opacity-50"
            >
              {t('auth.forgotPassword')}
            </button>
          </div>
        </div>
        <Input
          label={t('settings.newPassword')}
          type="password"
          autoComplete="new-password"
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder={t('auth.passwordHint')}
        />
        <Input
          label={t('settings.confirmPassword')}
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-emerald-700">{notice}</p>}
        <Button
          type="submit"
          loading={busy}
          disabled={!current || !next || !confirm}
          className="w-full"
        >
          {t('settings.changePassword')}
        </Button>
      </form>
    </Modal>
  );
}
