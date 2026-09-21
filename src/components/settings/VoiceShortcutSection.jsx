import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Check, Copy, Link2, Plug, Trash2 } from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import useAuth from '../../hooks/useAuth';
import useT from '../../hooks/useT';
import useCopyToClipboard from '../../hooks/useCopyToClipboard';
import {
  createAgentToken,
  deleteAgentToken,
  listAgentTokens,
  mcpUrl,
  openApiUrl,
  restUrl,
  revokeAgentToken,
} from '../../services/agentTokens';

// Pairing tokens, so a chatbot or a phone shortcut can add entries without the
// app being open. Each row is one connected thing; the URL next to it is what
// gets pasted over there, and "last used" is how a family finds out whether
// their shortcut ever actually arrived.
export default function VoiceShortcutSection() {
  const { user, userDoc, family } = useAuth();
  const { t, locale } = useT();
  const [copied, copy] = useCopyToClipboard();
  const [copiedToken, setCopiedToken] = useState('');

  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const familyId = family?.id;

  const refresh = useCallback(async () => {
    if (!familyId) return;
    try {
      setTokens(await listAgentTokens(familyId));
      setError('');
    } catch (err) {
      setError(err?.message || t('voiceLink.errList'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Whether the deployment can serve these tokens at all: a missing service
  // account is the difference between "paste this URL" and "nothing happens".
  useEffect(() => {
    let alive = true;
    fetch('/api/agent')
      .then((res) => res.json())
      .then((data) => alive && setStatus(data))
      .catch((err) => alive && setStatusError(err?.message || t('voiceLink.statusError')));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!familyId || !user?.uid) return;
    setBusy(true);
    setError('');
    try {
      await createAgentToken({
        familyId,
        userId: user.uid,
        label: label.trim() || t('voiceLink.defaultLabel'),
        locale,
      });
      setLabel('');
      await refresh();
    } catch (err) {
      setError(err?.message || t('voiceLink.errCreate'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(token) {
    setError('');
    try {
      await revokeAgentToken(token);
      await refresh();
    } catch (err) {
      setError(err?.message || t('voiceLink.errRevoke'));
    }
  }

  async function handleDelete(token) {
    setError('');
    try {
      await deleteAgentToken(token);
      await refresh();
    } catch (err) {
      setError(err?.message || t('voiceLink.errRevoke'));
    }
  }

  async function handleCopy(token) {
    const ok = await copy(mcpUrl(token));
    if (ok) setCopiedToken(token);
  }

  const ready = status && status.configured;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        <Plug size={14} /> {t('voiceLink.title')}
      </h2>
      <p className="mt-2 text-sm text-slate-600">{t('voiceLink.intro')}</p>

      <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
        {statusError ? (
          <p className="text-red-600">{statusError}</p>
        ) : !status ? (
          <p className="text-slate-500">{t('voiceLink.statusChecking')}</p>
        ) : ready ? (
          <p className="text-emerald-700">{t('voiceLink.statusReady')}</p>
        ) : (
          <>
            <p className="text-amber-700">{t('voiceLink.statusMissing')}</p>
            <p className="mt-1 font-mono text-xs text-slate-500">
              {(status.missing || []).join(', ')}
            </p>
          </>
        )}
      </div>

      {!loading && tokens.length > 0 && (
        <ul className="mt-4 space-y-2">
          {tokens.map((entry) => (
            <li key={entry.token} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`truncate text-sm font-medium ${entry.revoked ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                    {entry.label || t('voiceLink.defaultLabel')}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {entry.createdAt
                      ? t('voiceLink.created', { date: format(entry.createdAt, 'd MMM yyyy') })
                      : ''}
                    {' · '}
                    {entry.lastUsedAt
                      ? t('voiceLink.lastUsed', { date: format(entry.lastUsedAt, 'd MMM, HH:mm') })
                      : t('voiceLink.neverUsed')}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  {!entry.revoked && (
                    <button
                      type="button"
                      onClick={() => handleCopy(entry.token)}
                      aria-label={t('voiceLink.copyUrl')}
                      className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                    >
                      {copied && copiedToken === entry.token ? (
                        <Check size={15} className="text-emerald-600" />
                      ) : (
                        <Copy size={15} />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => (entry.revoked ? handleDelete(entry.token) : handleRevoke(entry.token))}
                    aria-label={entry.revoked ? t('voiceLink.remove') : t('voiceLink.revoke')}
                    className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="mt-4 space-y-2">
        <Input
          label={t('voiceLink.labelLabel')}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('voiceLink.labelPlaceholder')}
          maxLength={60}
        />
        <Button type="submit" variant="secondary" loading={busy} className="w-full">
          <Link2 size={16} />
          {t('voiceLink.create')}
        </Button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <p className="mt-3 text-xs text-slate-500">{t('voiceLink.secretWarning')}</p>
      <p className="mt-2 text-xs text-slate-400">
        {t('voiceLink.endpointHint', { rest: restUrl(), schema: openApiUrl() })}
      </p>
      <p className="mt-1 text-xs text-slate-400">{t('voiceLink.docsHint')}</p>
    </section>
  );
}
