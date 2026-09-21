import { useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import useT from '../../hooks/useT';
import VoiceAssistantButton from '../assistant/VoiceAssistantButton';
import { fetchAssistantStatus } from '../../services/assistant';

// Whether a chatbot is actually wired up, in the one place a family would look
// after a deployment. Without this the first voice attempt is the only way to
// find out that an API key is missing.
export default function AssistantSection() {
  const { t } = useT();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetchAssistantStatus()
      .then((data) => alive && setStatus(data))
      .catch((err) => alive && setError(err?.message || t('assistant.statusError')));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = status && status.configured && !status.missing?.length;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        <Mic size={14} /> {t('assistant.settingsTitle')}
      </h2>
      <p className="mt-2 text-sm text-slate-600">{t('assistant.settingsIntro')}</p>

      <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
        {error ? (
          <p className="text-red-600">{error}</p>
        ) : !status ? (
          <p className="text-slate-500">{t('assistant.statusChecking')}</p>
        ) : ready ? (
          <p className="text-emerald-700">
            {t('assistant.statusReady', { provider: status.provider, model: status.model })}
          </p>
        ) : (
          <>
            <p className="text-amber-700">{t('assistant.statusMissing')}</p>
            <p className="mt-1 font-mono text-xs text-slate-500">
              {(status.missing || []).join(', ')}
            </p>
          </>
        )}
      </div>

      {ready && <VoiceAssistantButton variant="solid" className="mt-4 w-full" />}
      <p className="mt-3 text-xs text-slate-500">{t('assistant.privacyNote')}</p>
      <p className="mt-1 text-xs text-slate-400">{t('assistant.settingsDocsHint')}</p>
    </section>
  );
}
