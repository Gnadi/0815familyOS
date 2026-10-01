import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, Plus, Settings } from 'lucide-react';
import useUIPreferences from '../../hooks/useUIPreferences';
import useNavLayout from '../../hooks/useNavLayout';
import useT from '../../hooks/useT';
import { useAddAction } from '../../context/AddActionContext';
import BrandMark from '../brand/BrandMark';

export default function TopBar({
  title,
  showAdd = true,
  right = null,
  onBack = null,
}) {
  const { skin } = useUIPreferences();
  const { t } = useT();
  const onAdd = useAddAction();
  const { bottomNav } = useNavLayout();
  const { pathname } = useLocation();
  const heading = title ?? t('common.appName');

  // A family may take Settings out of the bottom bar; it must stay reachable,
  // so the header picks up a gear instead.
  const settingsLink = !bottomNav.includes('settings') && !pathname.startsWith('/settings') && (
    <Link
      to="/settings"
      aria-label={t('nav.settings')}
      className={
        skin === 'ios'
          ? 'rounded-full p-1.5 text-brand-600 active:opacity-60'
          : 'rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }
    >
      <Settings size={skin === 'ios' ? 22 : 20} />
    </Link>
  );

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
                <span className="text-base">{t('common.back')}</span>
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-1">
              {right}
              {settingsLink}
              {showAdd && onAdd && (
                <button
                  onClick={onAdd}
                  aria-label={t('nav.add')}
                  className="rounded-full p-1.5 text-brand-600 active:opacity-60"
                >
                  <Plus size={24} />
                </button>
              )}
            </div>
          </div>
          <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-slate-900">
            {heading}
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
          <BrandMark className="h-8 w-8 rounded-lg" />
          <h1 className="text-lg font-bold text-slate-900">{heading}</h1>
        </div>
        <div className="flex items-center gap-2">
          {right}
          {settingsLink}
        </div>
      </div>
    </header>
  );
}
