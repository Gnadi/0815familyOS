import { forwardRef } from 'react';
import useUIPreferences from '../../hooks/useUIPreferences';

const Input = forwardRef(function Input(
  { label, error, className = '', ...rest },
  ref
) {
  const { skin } = useUIPreferences();
  // iOS form fields read as filled, inset rows (light gray fill, hairline-free)
  // rather than the Material bordered + elevated field.
  const field =
    skin === 'ios'
      ? 'w-full rounded-xl border border-transparent bg-slate-100 px-4 py-3 text-base text-slate-900 placeholder-slate-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100'
      : 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder-slate-400 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100';
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      )}
      <input
        ref={ref}
        className={`${field} ${className}`}
        {...rest}
      />
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  );
});

export default Input;
