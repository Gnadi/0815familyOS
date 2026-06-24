import useUIPreferences from '../../hooks/useUIPreferences';

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  ...rest
}) {
  const { skin } = useUIPreferences();
  const ios = skin === 'ios';

  // iOS uses softer continuous corners, opacity-based press feedback instead of
  // Material's scale "ripple", and flatter fills. Material keeps the pill shape,
  // elevation and active:scale press.
  const base = ios
    ? 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:opacity-60 disabled:opacity-40 disabled:cursor-not-allowed'
    : 'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed';

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-5 py-3 text-base',
    lg: 'px-6 py-3.5 text-base',
  };

  const variants = ios
    ? {
        primary: 'bg-brand-500 text-white hover:bg-brand-600',
        secondary: 'bg-slate-100 text-brand-600 hover:bg-slate-200',
        ghost: 'text-brand-600 active:opacity-60',
        danger: 'bg-slate-100 text-red-600 hover:bg-slate-200',
      }
    : {
        primary: 'bg-brand-500 text-white shadow-sm hover:bg-brand-600',
        secondary: 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50',
        ghost: 'text-brand-600 hover:bg-brand-50',
        danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
      };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : (
        children
      )}
    </button>
  );
}
