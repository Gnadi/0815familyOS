export default function Spinner({ fullscreen = false, className = '' }) {
  const ring = (
    <div
      className={`h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500 ${className}`}
    />
  );
  if (!fullscreen) return ring;
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      {ring}
    </div>
  );
}
