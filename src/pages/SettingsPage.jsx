import { Copy, LogOut, Users } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import Button from '../components/common/Button';
import useAuth from '../hooks/useAuth';
import { updateUserDoc } from '../services/users';

const FONT_SIZES = [
  { id: 'sm', label: 'Small' },
  { id: 'md', label: 'Default' },
  { id: 'lg', label: 'Large' },
];

const ACCENT_COLORS = [
  { id: 'blue',   bg: 'bg-blue-500',    label: 'Blue' },
  { id: 'purple', bg: 'bg-violet-500',  label: 'Purple' },
  { id: 'green',  bg: 'bg-emerald-500', label: 'Green' },
  { id: 'rose',   bg: 'bg-rose-500',    label: 'Rose' },
  { id: 'amber',  bg: 'bg-amber-500',   label: 'Amber' },
];

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function SettingRow({ label, children, first = false }) {
  return (
    <div className={`flex items-center justify-between ${first ? '' : 'mt-4 border-t border-slate-100 pt-4 dark:border-slate-700'}`}>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { user, userDoc, family, signOut } = useAuth();

  function update(patch) {
    updateUserDoc(user.uid, patch);
  }

  const currentFontSize = userDoc?.fontSize ?? 'md';
  const currentAccent   = userDoc?.accentColor ?? 'blue';

  return (
    <>
      <TopBar title="Settings" />
      <main className="mx-auto max-w-md space-y-5 px-5 py-5">
        <section className="rounded-2xl bg-white p-5 shadow-card dark:bg-slate-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Account
          </h2>
          <div className="mt-3 space-y-1">
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              {userDoc?.displayName || user?.displayName}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
          </div>
        </section>

        {family && (
          <section className="rounded-2xl bg-white p-5 shadow-card dark:bg-slate-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Family
            </h2>
            <p className="mt-3 text-base font-semibold text-slate-900 dark:text-white">{family.name}</p>

            <div className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-700">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Invite Code
              </p>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-mono text-lg font-bold tracking-[0.25em] text-slate-900 dark:text-white">
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

            <div className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Users size={16} className="text-slate-400 dark:text-slate-500" />
              <span>
                {family.memberIds?.length || 1}{' '}
                {family.memberIds?.length === 1 ? 'member' : 'members'}
              </span>
            </div>
          </section>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-card dark:bg-slate-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Appearance
          </h2>

          <SettingRow label="Hide navigation labels" first>
            <Toggle
              checked={!!userDoc?.hideNavLabels}
              onChange={() => update({ hideNavLabels: !userDoc?.hideNavLabels })}
            />
          </SettingRow>

          <SettingRow label="Dark theme">
            <Toggle
              checked={!!userDoc?.darkTheme}
              onChange={() => update({ darkTheme: !userDoc?.darkTheme })}
            />
          </SettingRow>

          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Text size</span>
            <div className="mt-2 flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-600 dark:bg-slate-700">
              {FONT_SIZES.map(({ id, label }) => {
                const active = currentFontSize === id;
                return (
                  <button
                    key={id}
                    onClick={() => update({ fontSize: id })}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                      active
                        ? 'bg-white shadow-sm text-slate-900 dark:bg-slate-600 dark:text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Accent color</span>
            <div className="mt-2 flex gap-3">
              {ACCENT_COLORS.map(({ id, bg, label }) => {
                const active = currentAccent === id;
                return (
                  <button
                    key={id}
                    aria-label={label}
                    onClick={() => update({ accentColor: id })}
                    className={`h-8 w-8 rounded-full ${bg} ring-offset-2 transition dark:ring-offset-slate-800 ${
                      active
                        ? 'ring-2 ring-slate-900 dark:ring-white'
                        : 'hover:opacity-80'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </section>

        <Button variant="secondary" onClick={signOut} className="w-full">
          <LogOut size={16} />
          Sign out
        </Button>
      </main>
    </>
  );
}
