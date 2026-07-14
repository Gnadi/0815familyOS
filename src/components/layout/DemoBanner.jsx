import { Sparkles } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import useT from '../../hooks/useT';
import { exitDemo } from '../../lib/demoMode';

// Slim bar shown across the app while demo mode is active. Both actions are
// hard navigations via exitDemo — the signup CTA must clear the flag first,
// or SignupPage's signed-in redirect would bounce straight back to the
// demo dashboard.
export default function DemoBanner() {
  const { isDemo } = useAuth();
  const { t } = useT();
  if (!isDemo) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-brand-600 px-4 py-2 text-center text-xs font-medium text-white">
      <span className="inline-flex items-center gap-1.5">
        <Sparkles size={13} className="flex-shrink-0" />
        {t('demo.banner')}
      </span>
      <span className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => exitDemo('/signup')}
          className="font-bold underline underline-offset-2"
        >
          {t('demo.bannerCta')}
        </button>
        <button
          type="button"
          onClick={() => exitDemo('/')}
          className="rounded-full border border-white/40 px-2.5 py-0.5 font-semibold hover:bg-white/10"
        >
          {t('demo.bannerExit')}
        </button>
      </span>
    </div>
  );
}
