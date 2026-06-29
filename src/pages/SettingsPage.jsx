import { useState } from 'react';
import { Cake, Check, Copy, Download, Languages, LogOut, Moon, Palette, Plus, Smartphone, Sun, Trash2, Users } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import Button from '../components/common/Button';
import useAuth from '../hooks/useAuth';
import useUIPreferences from '../hooks/useUIPreferences';
import useT from '../hooks/useT';
import { SKINS, THEMES } from '../context/UIPreferencesContext';
import { LOCALES } from '../i18n/config';
import { addKid, removeKid, updateKid } from '../services/families';
import { exportFamilyData } from '../utils/exportFamily';
import CalendarImportSection from '../components/settings/CalendarImportSection';

// THEME/SKIN ids → settings.* translation keys for their human labels.
const THEME_LABEL_KEYS = {
  blue: 'settings.themeBlue',
  emerald: 'settings.themeEmerald',
  rose: 'settings.themeRose',
  violet: 'settings.themeViolet',
  amber: 'settings.themeAmber',
};
const SKIN_LABEL_KEYS = { material: 'settings.skinMaterial', ios: 'settings.skinIos' };

export default function SettingsPage() {
  const { user, userDoc, family, signOut } = useAuth();
  const { theme, setTheme, mode, setMode, skin, setSkin, showLabels, setShowLabels } = useUIPreferences();
  const { t, tn, locale, setLocale } = useT();
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
      setExportError(err.message || t('settings.exportFailed'));
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <>
      <TopBar title={t('settings.title')} />
      <main className="mx-auto max-w-md space-y-5 px-5 py-5">
        <section className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            <Languages size={14} /> {t('settings.language')}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {LOCALES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLocale(l.code)}
                aria-pressed={locale === l.code}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                  locale === l.code
                    ? 'border-brand-400 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span aria-hidden>{l.flag}</span> {l.nativeLabel}
                {locale === l.code && <Check size={15} className="text-brand-600" />}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            <Palette size={14} /> {t('settings.appearance')}
          </h2>

          <div className="mt-4">
            <p className="text-sm font-medium text-slate-700">{t('settings.colorTheme')}</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {THEMES.map((th) => {
                const active = theme === th.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setTheme(th.id)}
                    aria-label={t(THEME_LABEL_KEYS[th.id] || th.label)}
                    aria-pressed={active}
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                      active ? 'ring-2 ring-offset-2 ring-slate-400' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: th.swatch }}
                  >
                    {active && <Check size={18} className="text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium text-slate-700">{t('settings.designStyle')}</p>
            <div className="mt-2 flex rounded-xl border border-slate-200 bg-slate-100 p-1">
              {SKINS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSkin(s.id)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
                    skin === s.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {s.id === 'ios' ? <Smartphone size={15} /> : <Palette size={15} />} {t(SKIN_LABEL_KEYS[s.id] || s.label)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium text-slate-700">{t('settings.mode')}</p>
            <div className="mt-2 flex rounded-xl border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode('light')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
                  mode === 'light' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Sun size={15} /> {t('settings.light')}
              </button>
              <button
                type="button"
                onClick={() => setMode('dark')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
                  mode === 'dark' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Moon size={15} /> {t('settings.dark')}
              </button>
            </div>
          </div>

          <label className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
            <span className="text-sm font-medium text-slate-700">
              {t('settings.showMenuLabels')}
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
            {t('settings.account')}
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
              {t('settings.family')}
            </h2>
            <p className="mt-3 text-base font-semibold text-slate-900">{family.name}</p>

            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                {t('settings.inviteCode')}
              </p>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-mono text-lg font-bold tracking-[0.25em] text-slate-900">
                  {family.inviteCode}
                </span>
                <button
                  onClick={() => navigator.clipboard?.writeText(family.inviteCode)}
                  className="flex items-center gap-1 text-sm font-semibold text-brand-600"
                >
                  <Copy size={14} /> {t('settings.copy')}
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <Users size={16} className="text-slate-400" />
              <span>{tn('settings.members', family.memberIds?.length || 1)}</span>
            </div>
          </section>
        )}

        {family && (
          <section className="rounded-2xl bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              <Cake size={14} /> {t('settings.kids')}
            </h2>

            <div className="mt-3 space-y-2">
              {(family.kids || []).map((kid) => (
                <div key={kid.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{kid.name}</p>
                    <label className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>{t('settings.birthday')}</span>
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
                      if (confirm(t('settings.removeKidConfirm', { name: kid.name }))) removeKid(family.id, kid);
                    }}
                    aria-label={t('settings.removeKidLabel', { name: kid.name })}
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
                placeholder={t('settings.addChildName')}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <button
                type="submit"
                disabled={!newKidName.trim()}
                className="flex items-center justify-center rounded-xl bg-brand-500 px-3 text-white shadow-sm hover:bg-brand-600 disabled:opacity-40"
                aria-label={t('settings.addChild')}
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
              <Download size={14} /> {t('settings.data')}
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              {t('settings.dataDesc')}
            </p>
            {exportError && <p className="mt-2 text-sm text-red-600">{exportError}</p>}
            <Button variant="secondary" onClick={handleExport} loading={exportBusy} className="mt-3 w-full">
              <Download size={16} />
              {t('settings.exportBtn')}
            </Button>
          </section>
        )}

        <Button variant="secondary" onClick={signOut} className="w-full">
          <LogOut size={16} />
          {t('settings.signOut')}
        </Button>
      </main>
    </>
  );
}
