import { useState } from 'react';
import { Cake, Check, Copy, Download, LogOut, Moon, Palette, Plus, Sun, Trash2, Users } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import Button from '../components/common/Button';
import useAuth from '../hooks/useAuth';
import useUIPreferences from '../hooks/useUIPreferences';
import { THEMES } from '../context/UIPreferencesContext';
import { addKid, removeKid, updateKid } from '../services/families';
import { exportFamilyData } from '../utils/exportFamily';
import CalendarImportSection from '../components/settings/CalendarImportSection';

export default function SettingsPage() {
  const { user, userDoc, family, signOut } = useAuth();
  const { theme, setTheme, mode, setMode, showLabels, setShowLabels } = useUIPreferences();
  const [newKidName, setNewKidName] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState('');

  async function handleAddKid(e) {
    e.preventDefault();
    const name = newKidName.trim();
    if (!name || !family?.id) return;
    await addKid(family.id, name, family.kids?.length || 0);
    setNewKidName('');
  }

  async function handleExport() {
    if (!family?.id) return;
    setExportError('');
    setExportBusy(true);
    try {
      await exportFamilyData({ family, user, userDoc });
    } catch (err) {
      setExportError(err.message || 'Export failed.');
    } finally {
      setExportBusy(false);
    }
  }

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

        {family && (
          <section className="rounded-2xl bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              <Cake size={14} /> Kids
            </h2>

            <div className="mt-3 space-y-2">
              {(family.kids || []).map((kid) => (
                <div key={kid.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{kid.name}</p>
                    <label className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>Birthday</span>
                      <input
                        type="date"
                        defaultValue={kid.birthday || ''}
                        onBlur={(e) => {
                          const next = e.target.value || null;
                          if ((kid.birthday || null) !== next) {
                            updateKid(family.id, kid.id, { birthday: next });
                          }
                        }}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-200"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remove ${kid.name}?`)) removeKid(family.id, kid);
                    }}
                    aria-label={`Remove ${kid.name}`}
                    className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddKid} className="mt-3 flex gap-2">
              <input
                type="text"
                value={newKidName}
                onChange={(e) => setNewKidName(e.target.value)}
                placeholder="Add child name"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <button
                type="submit"
                disabled={!newKidName.trim()}
                className="flex items-center justify-center rounded-xl bg-brand-500 px-3 text-white shadow-sm hover:bg-brand-600 disabled:opacity-40"
                aria-label="Add child"
              >
                <Plus size={18} />
              </button>
            </form>
          </section>
        )}

        {family && <CalendarImportSection />}

        {family && (
          <section className="rounded-2xl bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              <Download size={14} /> Data
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Download a JSON backup of your family — events, tasks, gifts, documents, and vaccinations.
            </p>
            {exportError && <p className="mt-2 text-sm text-red-600">{exportError}</p>}
            <Button variant="secondary" onClick={handleExport} loading={exportBusy} className="mt-3 w-full">
              <Download size={16} />
              Export family data (JSON)
            </Button>
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
