import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  FileText,
  Gift,
  ListChecks,
  UtensilsCrossed,
  ShoppingBasket,
  Syringe,
  Github,
  Sparkles,
  ShieldCheck,
  Heart,
  Zap,
  Bell,
  Users,
  ArrowRight,
  Check,
} from 'lucide-react';
import Seo from '../components/seo/Seo';
import BrandMark from '../components/brand/BrandMark';
import useAuth from '../hooks/useAuth';
import useT from '../hooks/useT';
import { SITE_URL, SITE_NAME } from '../config/site';

const GITHUB_URL = 'https://github.com/gnadi/0815familyOS';

// The product modules, each keyed to the landing namespace. Order is roughly
// "most-used first" so the strongest features lead the grid.
const features = [
  { Icon: Calendar, key: 'Calendar' },
  { Icon: ListChecks, key: 'Tasks' },
  { Icon: UtensilsCrossed, key: 'Meals' },
  { Icon: ShoppingBasket, key: 'Shopping' },
  { Icon: FileText, key: 'Vault' },
  { Icon: Syringe, key: 'Health' },
  { Icon: Gift, key: 'Gifts' },
];

const steps = [
  { Icon: Users, key: 'step1' },
  { Icon: Sparkles, key: 'step2' },
  { Icon: Bell, key: 'step3' },
];

export default function LandingPage() {
  const { user, userDoc, loading } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web',
    url: SITE_URL,
    description: t('landing.metaDescription'),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  // Authenticated visitors are redirected away from the marketing page. This
  // runs as a post-hydration effect (not during render) so the initial render
  // is always the static marketing content — identical on the server and the
  // client's first paint, avoiding any hydration mismatch with the pre-rendered
  // HTML. Crawlers and logged-out visitors see the full content immediately.
  useEffect(() => {
    if (loading) return;
    if (user && userDoc?.familyId) navigate('/dashboard', { replace: true });
    else if (user && userDoc && !userDoc.familyId)
      navigate('/family-setup', { replace: true });
  }, [user, userDoc, loading, navigate]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo
        title={t('landing.metaTitle')}
        description={t('landing.metaDescription')}
        path="/"
        jsonLd={jsonLd}
      />

      {/* Sticky nav */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link to="/" className="flex items-center gap-2">
            <BrandMark className="h-8 w-8 shadow-sm rounded-xl" />
            <span className="text-base font-bold tracking-tight">{t('common.appName')}</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">{t('landing.navFeatures')}</a>
            <a href="#open-source" className="hover:text-slate-900">{t('landing.navOpenSource')}</a>
            <a href="#how" className="hover:text-slate-900">{t('landing.navHow')}</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:inline-flex"
            >
              {t('landing.signIn')}
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center justify-center rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
            >
              {t('landing.getStarted')}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 to-white" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 15%, rgb(var(--brand-200) / 0.5) 0, transparent 35%), radial-gradient(circle at 85% 10%, rgb(var(--brand-100) / 0.7) 0, transparent 40%)',
          }}
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:py-24 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-semibold text-brand-700">
              <Sparkles size={13} />
              {t('landing.badgeFree')}
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              {t('landing.heroTitleA')}
              <br />
              {t('landing.heroTitleB')}{' '}
              <span className="text-brand-500">{t('landing.heroTitleHighlight')}</span>{' '}
              {t('landing.heroTitleC')}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
              {t('landing.heroSubtitle')}
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
              <Link
                to="/signup"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/20 hover:bg-brand-600 sm:w-auto"
              >
                {t('landing.ctaGetStartedFree')}
                <ArrowRight size={18} />
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-7 py-3.5 text-base font-semibold text-slate-800 hover:bg-slate-50 sm:w-auto"
              >
                <Github size={18} />
                {t('landing.ctaViewGithub')}
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-500 lg:justify-start">
              <span className="inline-flex items-center gap-1.5"><Check size={15} className="text-brand-500" /> {t('landing.bulletNoCard')}</span>
              <span className="inline-flex items-center gap-1.5"><Check size={15} className="text-brand-500" /> {t('landing.bulletNoAds')}</span>
              <span className="inline-flex items-center gap-1.5"><Check size={15} className="text-brand-500" /> {t('landing.bulletYourData')}</span>
            </div>
          </div>

          {/* Hero visual: real product screenshot */}
          <div className="relative mx-auto w-full max-w-[280px] sm:max-w-[320px]">
            <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-brand-400/30 to-brand-600/20 blur-3xl" />
            <img
              src="/screenshots/dashboard.png"
              alt={t('landing.heroShotAlt')}
              width={390}
              height={844}
              loading="eager"
              className="w-full drop-shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* What the name means */}
      <section className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-3xl px-5 py-12 text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-brand-600">
            {t('landing.nameKicker')}
          </span>
          <p className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            <span className="text-brand-500">Fa</span>mily{' '}
            <span className="text-slate-400">+</span>{' '}
            <span className="text-brand-500">OS</span>{' '}
            <span className="text-slate-400">=</span>{' '}
            my<span className="text-brand-500">FAOS</span>
          </p>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600">
            {t('landing.nameMeaningBody')}
          </p>
        </div>
      </section>

      {/* Chaos → order narrative */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-5xl px-5 py-16 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('landing.mentalLoadTitle')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
            {t('landing.mentalLoadBody')}
          </p>
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
            <StatCard value="7" label={t('landing.statModules')} />
            <StatCard value={t('landing.statRealtimeValue')} label={t('landing.statRealtime')} />
            <StatCard value="€0" label={t('landing.statFree')} />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-brand-600">
            {t('landing.featuresKicker')}
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {t('landing.featuresTitle')}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            {t('landing.featuresSubtitle')}
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.key}
              className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-card transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 transition group-hover:bg-brand-500 group-hover:text-white">
                <f.Icon size={24} />
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900">{t(`landing.feat${f.key}Title`)}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                {t(`landing.feat${f.key}Desc`)}
              </p>
              <ul className="mt-4 space-y-1.5">
                {[1, 2, 3].map((n) => (
                  <li key={n} className="flex items-center gap-2 text-sm text-slate-500">
                    <Check size={15} className="flex-shrink-0 text-brand-500" />
                    {t(`landing.feat${f.key}P${n}`)}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* Screenshot gallery */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wide text-brand-600">
              {t('landing.galleryKicker')}
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {t('landing.galleryTitle')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              {t('landing.gallerySubtitle')}
            </p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-6 sm:gap-8 lg:grid-cols-4">
            {[
              { src: '/screenshots/dashboard.png', cap: 'shotDashboardCap' },
              { src: '/screenshots/calendar.png', cap: 'shotCalendarCap' },
              { src: '/screenshots/tasks.png', cap: 'shotTasksCap' },
              { src: '/screenshots/meals.png', cap: 'shotMealsCap' },
              { src: '/screenshots/shopping.png', cap: 'shotShoppingCap' },
              { src: '/screenshots/gifts.png', cap: 'shotGiftsCap' },
              { src: '/screenshots/vault.png', cap: 'shotVaultCap' },
              { src: '/screenshots/health.png', cap: 'shotHealthCap' },
            ].map((s) => (
              <figure key={s.src} className="flex flex-col items-center text-center">
                <img
                  src={s.src}
                  alt={t(`landing.${s.cap}`)}
                  width={390}
                  height={844}
                  loading="lazy"
                  className="w-full drop-shadow-xl transition hover:-translate-y-1"
                />
                <figcaption className="mt-4 text-sm font-medium text-slate-600">
                  {t(`landing.${s.cap}`)}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Free & open source */}
      <section id="open-source" className="relative overflow-hidden bg-slate-900 text-white">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 80% 20%, rgb(var(--brand-500) / 0.6) 0, transparent 45%), radial-gradient(circle at 10% 90%, rgb(var(--brand-600) / 0.5) 0, transparent 45%)',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">
              <Github size={13} />
              {t('landing.osBadge')}
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              {t('landing.osTitle')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/80">
              {t('landing.osBody')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-base font-semibold text-slate-900 hover:bg-slate-100"
              >
                <Github size={18} />
                {t('landing.osStar')}
              </a>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-6 py-3 text-base font-semibold text-white hover:bg-white/10"
              >
                {t('landing.osStartUsing')}
              </Link>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ValueCard Icon={Heart} title={t('landing.valueAlwaysFreeTitle')} body={t('landing.valueAlwaysFreeBody')} />
            <ValueCard Icon={Github} title={t('landing.valueOpenSourceTitle')} body={t('landing.valueOpenSourceBody')} />
            <ValueCard Icon={ShieldCheck} title={t('landing.valuePrivateTitle')} body={t('landing.valuePrivateBody')} />
            <ValueCard Icon={Zap} title={t('landing.valueRealtimeTitle')} body={t('landing.valueRealtimeBody')} />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t('landing.howTitle')}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            {t('landing.howSubtitle')}
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.key} className="relative rounded-3xl border border-slate-200 bg-white p-7 shadow-card">
              <span className="absolute right-6 top-6 text-5xl font-extrabold text-slate-100">
                {i + 1}
              </span>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
                <s.Icon size={24} />
              </div>
              <h3 className="mt-5 text-lg font-bold">{t(`landing.${s.key}Title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{t(`landing.${s.key}Body`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 pb-20">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] bg-brand-500 px-6 py-16 text-center text-white sm:px-12">
          <div
            aria-hidden
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.5) 0, transparent 40%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.4) 0, transparent 40%)',
            }}
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t('landing.finalTitle')}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/90">
              {t('landing.finalBody')}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/signup"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-slate-900 shadow-lg hover:bg-slate-50 sm:w-auto"
              >
                {t('landing.finalCta')}
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center rounded-full border border-white/40 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 sm:w-auto"
              >
                {t('landing.signIn')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <Link to="/" className="flex items-center gap-2">
              <BrandMark className="h-8 w-8 rounded-xl" />
              <span className="text-base font-bold tracking-tight">{t('common.appName')}</span>
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
              <a href="#features" className="hover:text-slate-800">{t('landing.navFeatures')}</a>
              <a href="#open-source" className="hover:text-slate-800">{t('landing.navOpenSource')}</a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-slate-800"
              >
                <Github size={15} />
                GitHub
              </a>
              <a href="#" className="hover:text-slate-800">{t('landing.footerPrivacy')}</a>
              <a href="#" className="hover:text-slate-800">{t('landing.footerTerms')}</a>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} {t('common.appName')} · {t('landing.footerTagline')}
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ value, label }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-7 shadow-card">
      <p className="text-3xl font-extrabold text-brand-500">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function ValueCard({ Icon, title, body }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
        <Icon size={20} />
      </span>
      <h3 className="mt-4 text-base font-bold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-white/70">{body}</p>
    </div>
  );
}
