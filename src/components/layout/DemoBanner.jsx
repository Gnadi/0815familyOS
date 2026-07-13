import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import useT from '../../hooks/useT';

// Slim bar shown across the app while an anonymous demo session is active.
// Demo data lives in its own throwaway family, so the only path forward is a
// real account.
export default function DemoBanner() {
  const { user } = useAuth();
  const { t } = useT();
  if (!user?.isAnonymous) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-brand-600 px-4 py-2 text-center text-xs font-medium text-white">
      <Sparkles size={13} className="hidden flex-shrink-0 sm:block" />
      <span>
        {t('demo.banner')}{' '}
        <Link to="/signup" className="font-bold underline underline-offset-2">
          {t('demo.bannerCta')}
        </Link>
      </span>
    </div>
  );
}
