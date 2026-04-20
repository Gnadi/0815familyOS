import { Bell, Home } from 'lucide-react';

export default function TopBar({ title = 'Family OS', showBell = true, right = null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <div className="flex items-center gap-2">
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
