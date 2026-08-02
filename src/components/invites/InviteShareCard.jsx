import { useState } from 'react';
import { Check, Copy, QrCode as QrIcon, RefreshCw, Share2 } from 'lucide-react';
import Button from '../common/Button';
import QrCode from './QrCode';
import useAuth from '../../hooks/useAuth';
import useT from '../../hooks/useT';
import useCopyToClipboard from '../../hooks/useCopyToClipboard';
import { createFamilyInvite, inviteUrl, revokeFamilyInvite } from '../../services/families';

// The family's current invite link, with the ways people actually pass a link
// around: copy, the OS share sheet, and a QR code to point a phone at.
//
// Shared by SettingsPage and the post-create screen in FamilySetupPage so both
// behave identically.
export default function InviteShareCard({ compact = false }) {
  const { user, userDoc, family } = useAuth();
  const { t, locale } = useT();
  const [copied, copy] = useCopyToClipboard();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showQr, setShowQr] = useState(false);

  // /invites denies `list`, so a family's live tokens are tracked on the family
  // document. Expired entries are filtered out here — there is no scheduler to
  // prune them.
  const invite =
    (family?.activeInvites || [])
      .filter((i) => i?.token && (!i.expiresAt || new Date(i.expiresAt) > new Date()))
      .slice(-1)[0] || null;

  const url = invite ? inviteUrl(invite.token) : '';
  // Rendered only when the browser has it — desktop Firefox does not, and the
  // SSG pass runs in Node.
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function handleCreate() {
    if (!family?.id) return;
    setError('');
    setBusy(true);
    try {
      await createFamilyInvite({
        familyId: family.id,
        familyName: family.name,
        uid: user.uid,
        displayName: userDoc?.displayName || user?.displayName || '',
      });
    } catch (err) {
      setError(err.message || t('invite.errCreate'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (!family?.id || !invite) return;
    if (!window.confirm(t('invite.revokeConfirm'))) return;
    setError('');
    setBusy(true);
    try {
      await revokeFamilyInvite(family.id, invite.token);
      setShowQr(false);
    } catch (err) {
      setError(err.message || t('invite.errRevoke'));
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    try {
      await navigator.share({
        title: t('invite.shareTitle'),
        text: t('invite.shareText', { family: family?.name || '' }),
        url,
      });
    } catch (err) {
      // The user dismissing the sheet is not an error worth showing.
      if (err?.name !== 'AbortError') setError(err?.message || t('invite.errShare'));
    }
  }

  // Right after createFamily the family snapshot has not necessarily arrived
  // yet. Without this the card would offer "create invite link" and mint a
  // second one on top of the invite that was just created.
  if (!family) {
    return <div className="h-20 animate-pulse rounded-xl bg-slate-100" aria-hidden />;
  }

  if (!invite) {
    return (
      <div className={compact ? '' : 'rounded-xl bg-slate-50 p-4'}>
        <p className="text-sm text-slate-600">{t('invite.noActiveInvite')}</p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <Button variant="secondary" onClick={handleCreate} loading={busy} className="mt-3 w-full">
          {t('invite.createLink')}
        </Button>
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'rounded-xl bg-slate-50 p-4'}>
      <p className="break-all font-mono text-xs text-slate-900">{url}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => copy(url)}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? t('invite.copied') : t('invite.copyLink')}
        </Button>
        {canShare && (
          <Button variant="secondary" size="sm" onClick={handleShare}>
            <Share2 size={14} /> {t('invite.share')}
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => setShowQr((v) => !v)}>
          <QrIcon size={14} /> {showQr ? t('invite.hideQr') : t('invite.showQr')}
        </Button>
      </div>

      {showQr && (
        <div className="mt-4">
          <QrCode value={url} label={t('invite.qrAlt', { family: family?.name || '' })} />
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {invite.expiresAt && (
          <p className="text-xs text-slate-400">
            {t('invite.expiresOn', {
              date: new Date(invite.expiresAt).toLocaleDateString(locale, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }),
            })}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
          >
            <RefreshCw size={12} /> {t('invite.newLink')}
          </button>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={busy}
            className="text-xs font-semibold text-slate-500 hover:text-red-600 disabled:opacity-50"
          >
            {t('invite.revoke')}
          </button>
        </div>
      </div>
    </div>
  );
}
