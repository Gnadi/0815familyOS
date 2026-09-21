import { useState } from 'react';
import { Mic } from 'lucide-react';
import useT from '../../hooks/useT';
import VoiceAssistantModal from './VoiceAssistantModal';

// The entry point into the voice assistant. Owns the sheet itself, so placing
// the feature anywhere is a one-line import.
//   variant="dashed"  -> matches the dashed "add" buttons on the dashboard
//   variant="solid"    -> standalone, e.g. in Settings
export default function VoiceAssistantButton({ variant = 'dashed', className = '' }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

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
