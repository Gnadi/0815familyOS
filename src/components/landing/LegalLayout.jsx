import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Seo from '../seo/Seo';
import BrandMark from '../brand/BrandMark';
import useT from '../../hooks/useT';

// Shared shell for the public legal pages (/privacy, /terms). Content comes
// from the locale files as an array of { h, p: [] } sections so both pages
// stay fully translatable without JSX per paragraph.
export default function LegalLayout({ nsKey, path }) {
  const { t } = useT();
  const sections = t(`legal.${nsKey}.sections`);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo
        title={`${t(`legal.${nsKey}.title`)} · ${t('common.appName')}`}
        description={t(`legal.${nsKey}.metaDescription`)}
        path={path}
      />

      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <Link to="/" className="flex items-center gap-2">
            <BrandMark className="h-8 w-8 rounded-xl shadow-sm" />
            <span className="text-base font-bold tracking-tight">{t('common.appName')}</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            <ArrowLeft size={15} />
            {t('legal.backHome')}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t(`legal.${nsKey}.title`)}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{t(`legal.${nsKey}.updated`)}</p>

        {Array.isArray(sections) &&
          sections.map((section) => (
            <section key={section.h} className="mt-10">
              <h2 className="text-xl font-bold text-slate-900">{section.h}</h2>
              {section.p.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-base leading-relaxed text-slate-600">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} {t('common.appName')}</span>
          <div className="flex gap-5">
            <Link to="/privacy" className="hover:text-slate-800">{t('landing.footerPrivacy')}</Link>
            <Link to="/terms" className="hover:text-slate-800">{t('landing.footerTerms')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
