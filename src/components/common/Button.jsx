export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed';
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-5 py-3 text-base',
    lg: 'px-6 py-3.5 text-base',
  };
  const variants = {
    primary: 'bg-brand-500 text-white shadow-sm hover:bg-brand-600',
    secondary: 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 dark:hover:bg-slate-600',
    ghost: 'text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-slate-700',
    danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50 dark:bg-slate-700 dark:border-red-800 dark:hover:bg-red-950/40',
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
