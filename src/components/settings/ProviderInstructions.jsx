import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import useT from '../../hooks/useT';

// Provider content (labels, step lists, notes) lives in the locale files under
// calImport.providers.* so the whole guide translates. Only the ids and their
// order are kept here.
const PROVIDER_IDS = ['google', 'icloud', 'outlook', 'other'];

export default function ProviderInstructions() {
  const { t } = useT();
  const [openId, setOpenId] = useState('google');
  return (
    <div className="space-y-2">
      {PROVIDER_IDS.map((id) => {
        const open = openId === id;
        const label = t(`calImport.providers.${id}.label`);
        const steps = t(`calImport.providers.${id}.steps`);
        const note = t(`calImport.providers.${id}.note`);
        return (
          <div key={id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : id)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50"
            >
              <span className="text-sm font-semibold text-slate-900">{label}</span>
              <ChevronDown
                size={16}
                className={`text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`}
              />
            </button>
            {open && (
              <div className="space-y-2 px-4 pb-4 text-sm text-slate-700">
                <ol className="list-decimal space-y-1.5 pl-5">
                  {(Array.isArray(steps) ? steps : []).map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
                {note && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <strong>{t('calImport.noteLabel')}</strong> {note}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
