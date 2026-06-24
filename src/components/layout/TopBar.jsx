import { ArrowLeft, Bell, ChevronLeft, Home, Plus } from 'lucide-react';
import useUIPreferences from '../../hooks/useUIPreferences';
import { useAddAction } from '../../context/AddActionContext';

export default function TopBar({
  title = 'Family OS',
  showBell = true,
  showAdd = true,
  right = null,
  onBack = null,
}) {
  const { skin } = useUIPreferences();
  const onAdd = useAddAction();

  if (skin === 'ios') {
    return (
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 px-4 pb-2 pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-md">
          <div className="flex min-h-[1.75rem] items-center justify-between">
            {onBack ? (
              <button
                onClick={onBack}
                className="-ml-1.5 flex items-center text-brand-600 active:opacity-60"
              >
                <ChevronLeft size={24} />
                <span className="text-base">Back</span>
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-1">
              {right}
              {showBell && (
                <button className="relative rounded-full p-1.5 text-brand-600 active:opacity-60">
                  <Bell size={20} />
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
                </button>
              )}
              {showAdd && onAdd && (
                <button
                  onClick={onAdd}
                  aria-label="Add"
                  className="rounded-full p-1.5 text-brand-600 active:opacity-60"
                >
                  <Plus size={24} />
                </button>
              )}
            </div>
          </div>
          <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-slate-900">
            {title}
          </h1>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="-ml-1 rounded-full p-1.5 text-slate-600 hover:bg-slate-100">
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white">
            <Home size={18} />
          </div>
          <h1 className="text-lg font-bold text-slate-900">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {right}
          {showBell && (
            <button className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100">
              <Bell size={20} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
