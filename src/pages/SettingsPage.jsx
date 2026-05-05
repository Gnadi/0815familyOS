import { Check, Copy, LogOut, Moon, Palette, Sun, Users } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import Button from '../components/common/Button';
import useAuth from '../hooks/useAuth';
import useUIPreferences from '../hooks/useUIPreferences';
import { THEMES } from '../context/UIPreferencesContext';

export default function SettingsPage() {
  const { user, userDoc, family, signOut } = useAuth();
  const { theme, setTheme, mode, setMode, showLabels, setShowLabels } = useUIPreferences();

  return (
    <>
      <TopBar title="Settings" />
      <main className="mx-auto max-w-md space-y-5 px-5 py-5">
        <section className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            <Palette size={14} /> Appearance
          </h2>

          <div className="mt-4">
            <p className="text-sm font-medium text-slate-700">Color theme</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {THEMES.map((t) => {
                const active = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    aria-label={t.label}
                    aria-pressed={active}
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                      active ? 'ring-2 ring-offset-2 ring-slate-400' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: t.swatch }}
                  >
                    {active && <Check size={18} className="text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium text-slate-700">Mode</p>
            <div className="mt-2 flex rounded-xl border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode('light')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
                  mode === 'light' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Sun size={15} /> Light
              </button>
              <button
                type="button"
                onClick={() => setMode('dark')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
                  mode === 'dark' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Moon size={15} /> Dark
              </button>
            </div>
          </div>

          <label className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
            <span className="text-sm font-medium text-slate-700">
              Show menu labels
            </span>
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
          </label>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Account
          </h2>
          <div className="mt-3 space-y-1">
            <p className="text-base font-semibold text-slate-900">
              {userDoc?.displayName || user?.displayName}
            </p>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </section>

        {family && (
          <section className="rounded-2xl bg-white p-5 shadow-card">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Family
            </h2>
            <p className="mt-3 text-base font-semibold text-slate-900">{family.name}</p>

            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Invite Code
              </p>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-mono text-lg font-bold tracking-[0.25em] text-slate-900">
                  {family.inviteCode}
                </span>
                <button
                  onClick={() => navigator.clipboard?.writeText(family.inviteCode)}
                  className="flex items-center gap-1 text-sm font-semibold text-brand-600"
                >
                  <Copy size={14} /> Copy
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <Users size={16} className="text-slate-400" />
              <span>
                {family.memberIds?.length || 1}{' '}
                {family.memberIds?.length === 1 ? 'member' : 'members'}
              </span>
            </div>
          </section>
        )}

        <Button variant="secondary" onClick={signOut} className="w-full">
          <LogOut size={16} />
          Sign out
        </Button>
      </main>
    </>
  );
}
