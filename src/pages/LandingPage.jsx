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
import useAuth from '../hooks/useAuth';
import { SITE_URL, SITE_NAME } from '../config/site';

const GITHUB_URL = 'https://github.com/gnadi/0815familyOS';

// The product modules, each with the concrete payoff a family feels. Order is
// roughly "most-used first" so the strongest features lead the grid.
const features = [
  {
    Icon: Calendar,
    title: 'Shared Calendar',
    description:
      "Every appointment, practice, and parents' evening in one place. Changes sync in real time, so the moment one parent adds an event, everyone sees it.",
    points: ['Week & month views', 'Live sync across the family', 'No more double-bookings'],
  },
  {
    Icon: ListChecks,
    title: 'Task Manager',
    description:
      'A simple board for chores, homework, and to-dos. Assign them, set priorities, and watch a weekly capacity view so no single person is buried.',
    points: ['Assign & prioritize', 'Weekly capacity heatmap', 'Fair workload balance'],
  },
  {
    Icon: UtensilsCrossed,
    title: 'Meal Plan & Recipes',
    description:
      "Plan the week's dinners, save the recipes everyone loves, and decide who cooks — so 'what's for dinner?' is answered before it's even asked.",
    points: ['Weekly meal plan', 'Saved family recipes', 'Cook rotation'],
  },
  {
    Icon: ShoppingBasket,
    title: 'Shopping List',
    description:
      'A shared list the whole household can add to. Whoever passes the store picks up everything — nothing forgotten, no duplicate milk.',
    points: ['Shared in real time', 'Tick off on the go', 'Built for groceries'],
  },
  {
    Icon: FileText,
    title: 'Document Vault',
    description:
      'Keep medical records, school forms, and important child documents organized and easy to find — instead of scattered across drawers and inboxes.',
    points: ['Child documents', 'Medical & school records', 'Find it in seconds'],
  },
  {
    Icon: Syringe,
    title: 'Health & Vaccinations',
    description:
      "Track each child's vaccinations and health milestones so you always know what's done and what's coming up next.",
    points: ['Vaccination history', 'Per-child tracking', 'Stay ahead of due dates'],
  },
  {
    Icon: Gift,
    title: 'Gift Planner',
    description:
      'Collect gift ideas year-round for birthdays and holidays, so you are never caught empty-handed and never buy the same thing twice.',
    points: ['Idea collection', 'Birthdays & holidays', 'No more last-minute panic'],
  },
];

const steps = [
  {
    Icon: Users,
    title: 'Create your family',
    description:
      'Sign up free and start a family, or join an existing one with a 6-character invite code. Setup takes under a minute.',
  },
  {
    Icon: Sparkles,
    title: 'Add what matters',
    description:
      'Drop in events, tasks, meals, and shopping items. Everything lives in one shared, organized space.',
  },
  {
    Icon: Bell,
    title: 'Stay in sync',
    description:
      'Every family member sees the same up-to-date picture in real time — on the couch or on the go.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'Web',
  url: SITE_URL,
  description:
    'Family OS is a free, open-source app that turns family chaos into calm. A shared calendar, task manager, meal planner, shopping list, document vault, health tracker, and gift planner — all in one place.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function LandingPage() {
  const { user, userDoc, loading } = useAuth();
  const navigate = useNavigate();

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
        title="Family OS — Turn Family Chaos Into Calm"
        description="Family OS is a free, open-source app that organizes your household: shared calendar, tasks, meal plans, shopping lists, document vault, health tracking, and gift planning — all in one place."
        path="/"
        jsonLd={jsonLd}
      />

      {/* Sticky nav */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
              <Heart size={18} fill="currentColor" />
            </span>
            <span className="text-base font-bold tracking-tight">Family OS</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#open-source" className="hover:text-slate-900">Open Source</a>
            <a href="#how" className="hover:text-slate-900">How it works</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center justify-center rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
            >
              Get started
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
              100% Free &amp; Open Source
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              From family chaos
              <br />
              to <span className="text-brand-500">calm, organized</span> days
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
              Schedules, chores, meals, shopping, documents — running a family is a
              hundred little things at once. Family OS brings them into one shared,
              real-time home so everyone is finally on the same page.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
              <Link
                to="/signup"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/20 hover:bg-brand-600 sm:w-auto"
              >
                Get started — it's free
                <ArrowRight size={18} />
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-7 py-3.5 text-base font-semibold text-slate-800 hover:bg-slate-50 sm:w-auto"
              >
                <Github size={18} />
                View on GitHub
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-500 lg:justify-start">
              <span className="inline-flex items-center gap-1.5"><Check size={15} className="text-brand-500" /> No credit card</span>
              <span className="inline-flex items-center gap-1.5"><Check size={15} className="text-brand-500" /> No ads, no tracking</span>
              <span className="inline-flex items-center gap-1.5"><Check size={15} className="text-brand-500" /> Your data, your family</span>
            </div>
          </div>

          {/* Hero visual: a stylized app preview */}
          <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
            <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-gradient-to-br from-brand-400/30 to-brand-600/20 blur-2xl" />
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
              <div className="flex items-center justify-between bg-brand-500 px-5 py-4 text-white">
                <div>
                  <p className="text-xs font-medium text-white/80">This week</p>
                  <p className="text-lg font-bold">The Family</p>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                  <Calendar size={18} />
                </span>
              </div>
              <div className="space-y-3 p-5">
                <PreviewRow Icon={Calendar} label="Soccer practice" meta="Today · 17:00" tone="bg-brand-50 text-brand-600" />
                <PreviewRow Icon={ListChecks} label="Take out recycling" meta="Assigned to Alex" tone="bg-emerald-50 text-emerald-600" />
                <PreviewRow Icon={UtensilsCrossed} label="Pasta night" meta="Mom cooks · 19:00" tone="bg-amber-50 text-amber-600" />
                <PreviewRow Icon={ShoppingBasket} label="Groceries (6)" meta="Shared list" tone="bg-violet-50 text-violet-600" />
                <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
                  <Zap size={16} className="text-brand-400" />
                  Synced live with everyone
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Chaos → order narrative */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-5xl px-5 py-16 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            The mental load of family life is real
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
            Who has the dentist appointment? Did anyone buy bread? Whose turn is it
            to cook? Family life runs on dozens of details scattered across group
            chats, sticky notes, and someone's memory. Family OS gathers all of it
            into one calm, shared place — so the planning stops living in your head.
          </p>
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
            <StatCard value="7" label="modules, one app" />
            <StatCard value="Real-time" label="everyone stays in sync" />
            <StatCard value="€0" label="free, forever" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-brand-600">
            Everything in one place
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            One app for the whole household
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Each module solves one real source of family stress. Use the ones you
            need — they all work together, and they all stay in sync.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-card transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 transition group-hover:bg-brand-500 group-hover:text-white">
                <f.Icon size={24} />
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900">{f.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                {f.description}
              </p>
              <ul className="mt-4 space-y-1.5">
                {f.points.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm text-slate-500">
                    <Check size={15} className="flex-shrink-0 text-brand-500" />
                    {p}
                  </li>
                ))}
              </ul>
            </article>
          ))}
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
              MIT licensed
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Free and open source — by design
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/80">
              Family OS costs nothing and always will. The full source code is public
              under the MIT license, so anyone can inspect it, trust it, contribute to
              it, or even run their own copy. No subscriptions, no paywalled features,
              no selling your family's data. Just a tool built to help.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-base font-semibold text-slate-900 hover:bg-slate-100"
              >
                <Github size={18} />
                Star on GitHub
              </a>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-6 py-3 text-base font-semibold text-white hover:bg-white/10"
              >
                Start using it
              </Link>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ValueCard Icon={Heart} title="Always free" body="No price tags, no premium tier. Every feature, for every family." />
            <ValueCard Icon={Github} title="Open source" body="Public MIT-licensed code you can read, fork, and improve." />
            <ValueCard Icon={ShieldCheck} title="Private by default" body="No ads and no tracking — your family's data stays yours." />
            <ValueCard Icon={Zap} title="Real-time sync" body="Built on Firebase, so every change appears for everyone instantly." />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Organized in three steps
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            No long setup, no manual. You'll be running your family from one screen
            in minutes.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-3xl border border-slate-200 bg-white p-7 shadow-card">
              <span className="absolute right-6 top-6 text-5xl font-extrabold text-slate-100">
                {i + 1}
              </span>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
                <s.Icon size={24} />
              </div>
              <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.description}</p>
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
              Bring calm to your family's week
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/90">
              Join Family OS today — free, open source, and ready in minutes. Less
              chaos in your head, more time for the people who matter.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/signup"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-slate-900 shadow-lg hover:bg-slate-50 sm:w-auto"
              >
                Create your family
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center rounded-full border border-white/40 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 sm:w-auto"
              >
                Sign in
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
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white">
                <Heart size={18} fill="currentColor" />
              </span>
              <span className="text-base font-bold tracking-tight">Family OS</span>
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
              <a href="#features" className="hover:text-slate-800">Features</a>
              <a href="#open-source" className="hover:text-slate-800">Open Source</a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-slate-800"
              >
                <Github size={15} />
                GitHub
              </a>
              <a href="#" className="hover:text-slate-800">Privacy</a>
              <a href="#" className="hover:text-slate-800">Terms</a>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} Family OS · Free &amp; open source under the MIT license.
          </p>
        </div>
      </footer>
    </div>
  );
}

function PreviewRow({ Icon, label, meta, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card">
      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
        <p className="truncate text-xs text-slate-400">{meta}</p>
      </div>
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
