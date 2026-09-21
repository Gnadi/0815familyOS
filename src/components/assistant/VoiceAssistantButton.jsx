import { useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import useT from '../../hooks/useT';
import VoiceAssistantModal from './VoiceAssistantModal';

// The entry point into the voice assistant. Owns the sheet itself, so placing
// the feature anywhere is a one-line import.
//   variant="dashed"  -> matches the dashed "add" buttons on the dashboard
//   variant="solid"   -> standalone, e.g. in Settings
//   autoOpen          -> also respond to ?assistant=1 (see below)
export default function VoiceAssistantButton({
  variant = 'dashed',
  className = '',
  autoOpen = false,
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  // /dashboard?assistant=1 opens the sheet with the microphone already live.
  // That is what makes "Hey Google, open myFAOS voice" (or a long-press
  // shortcut on the home screen, or a Siri "open URL" action) land directly on
  // dictation instead of the dashboard.
  useEffect(() => {
    if (!autoOpen || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('assistant') !== '1') return;
    setOpen(true);
    // Drop the parameter, so a reload -- or the PWA restoring its last URL --
    // does not reopen the microphone unasked.
    params.delete('assistant');
    const rest = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
  }, [autoOpen]);

  const styles =
    variant === 'dashed'
      ? 'border border-dashed border-slate-300 text-brand-600 hover:bg-slate-50'
      : 'bg-brand-500 text-white shadow-sm hover:bg-brand-600';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition ${styles} ${className}`}
      >
        <Mic size={16} />
        {t('assistant.openLabel')}
      </button>
      <VoiceAssistantModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
