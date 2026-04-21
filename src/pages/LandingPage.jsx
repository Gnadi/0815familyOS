import { Link, Navigate } from 'react-router-dom';
import { Calendar, FileText, Gift, ListChecks } from 'lucide-react';
import FeatureCard from '../components/landing/FeatureCard';
import useAuth from '../hooks/useAuth';
import Spinner from '../components/common/Spinner';

const features = [
  {
    Icon: Calendar,
    title: 'Shared Calendar',
    description:
      "Keep track of everyone's schedules, appointments, and upcoming events in one shared view.",
    iconBg: 'bg-brand-50',
    iconColor: 'text-brand-500',
  },
  {
    Icon: FileText,
    title: 'Document Vault',
    description:
      'Securely store, organize, and share important child-related documents, medical records, and school forms.',
    iconBg: 'bg-brand-50',
    iconColor: 'text-brand-500',
  },
  {
    Icon: Gift,
    title: 'Gift Planner',
    description:
      'Easily plan, track, and manage gift ideas for birthdays, holidays, and special occasions.',
    iconBg: 'bg-brand-50',
    iconColor: 'text-brand-500',
  },
  {
    Icon: ListChecks,
    title: 'Task Manager',
    description:
      'Assign chores, track homework, and manage daily responsibilities with simple checklists.',
    iconBg: 'bg-brand-50',
    iconColor: 'text-brand-500',
  },
];

export default function LandingPage() {
  const { user, userDoc, loading } = useAuth();
  if (loading) return <Spinner fullscreen />;
  if (user && userDoc?.familyId) return <Navigate to="/dashboard" replace />;
  if (user && userDoc && !userDoc.familyId)
    return <Navigate to="/family-setup" replace />;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="mx-auto max-w-md">
          <h1 className="text-base font-bold text-slate-900">Family OS</h1>
        </div>
      </header>

      <section className="relative overflow-hidden bg-brand-500 px-6 py-16 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-700 opacity-95" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.4) 0, transparent 40%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.3) 0, transparent 40%)',
          }}
        />
        <div className="relative mx-auto flex max-w-md flex-col items-center text-center">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Organize Your<br />Family Life
          </h2>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/90">
            Manage schedules, tasks, and child documentation all in one single, secure place.
          </p>
          <Link
            to="/signup"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-base font-semibold text-slate-900 shadow-lg hover:bg-slate-50"
          >
            Get Started
          </Link>
          <p className="mt-4 text-sm text-white/90">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold underline">
              Sign in
            </Link>
          </p>
        </div>
      </section>

      <section className="px-5 py-12">
        <div className="mx-auto max-w-md text-center">
          <h2 className="text-2xl font-bold text-slate-900">Everything you need</h2>
          <p className="mt-2 text-sm text-slate-500">
            Discover how Family OS can simplify your daily life.
          </p>
        </div>
        <div className="mx-auto mt-6 grid max-w-md gap-4">
          {features.map((f) => (
            <FeatureCard key={f.title} icon={f.Icon} iconBg={f.iconBg} iconColor={f.iconColor} title={f.title} description={f.description} />
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-5 py-8">
        <div className="mx-auto max-w-md text-center text-sm text-slate-500">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <a href="#" className="hover:text-slate-700">Privacy Policy</a>
            <a href="#" className="hover:text-slate-700">Terms of Service</a>
            <a href="#" className="hover:text-slate-700">Contact Support</a>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            © {new Date().getFullYear()} Family OS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
