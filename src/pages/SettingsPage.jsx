import { Copy, LogOut, Users } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import Button from '../components/common/Button';
import useAuth from '../hooks/useAuth';
import { updateUserDoc } from '../services/users';

export default function SettingsPage() {
  const { user, userDoc, family, signOut } = useAuth();

  function toggleHideNavLabels() {
    updateUserDoc(user.uid, { hideNavLabels: !userDoc?.hideNavLabels });
  }

  return (
    <>
      <TopBar title="Settings" />
      <main className="mx-auto max-w-md space-y-5 px-5 py-5">
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

        <section className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Appearance
          </h2>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Hide navigation labels</span>
            <button
              role="switch"
              aria-checked={!!userDoc?.hideNavLabels}
              onClick={toggleHideNavLabels}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                userDoc?.hideNavLabels ? 'bg-brand-500' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  userDoc?.hideNavLabels ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
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
