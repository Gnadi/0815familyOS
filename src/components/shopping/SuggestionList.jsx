import { Plus } from 'lucide-react';
import useT from '../../hooks/useT';
import { guessProductIcon } from '../../utils/productIcons';
import { rhythmText } from './rhythmText';

// Products the family's own rhythm says are about to run out. One tap puts a
// product on the list; "still have it" snoozes it and teaches the rhythm.
export default function SuggestionList({ title, hint, suggestions, iconFor, onAdd, onStillHave }) {
  const { t, tn } = useT();
  if (suggestions.length === 0) return null;

  return (
    <section>
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
          <span className="rounded-full bg-brand-500 px-2 py-0.5 text-xs font-semibold text-white">
            {suggestions.length}
          </span>
        </div>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
      <ul className="overflow-hidden rounded-2xl bg-white shadow-card">
        {suggestions.map(({ product, prediction }) => (
          <li
            key={product.id}
            className="flex items-center gap-3 border-t border-slate-100 px-3 py-2.5 first:border-t-0"
          >
            <span className="text-2xl leading-none" aria-hidden="true">
              {iconFor(product) || guessProductIcon(product.title)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900">{product.title}</span>
              <span className="block text-xs leading-snug text-slate-500">{rhythmText(prediction, { t, tn })}</span>
            </span>
            <button
              type="button"
              onClick={() => onStillHave(product)}
              aria-label={t('shopping.stillHaveLabel', { name: product.title })}
              className="shrink-0 rounded-full px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              {t('shopping.stillHave')}
            </button>
            <button
              type="button"
              onClick={() => onAdd(product)}
              aria-label={t('shopping.addSuggestion', { name: product.title })}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm hover:bg-brand-600"
            >
              <Plus size={18} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
