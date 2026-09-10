import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import useT from '../../hooks/useT';
import { feedIssue } from '../../utils/feedMessages';

// A subscribed calendar that delivers nothing used to be invisible here: the
// week simply looked empty, exactly as it would with no subscription at all.
// This says which calendar is the problem and what kind of problem it is.
export default function FeedIssueBanner({ reports }) {
  const { t } = useT();

  const issues = (reports || [])
    .map((entry) => ({
      id: entry.subscription?.id,
      label: entry.subscription?.label || t('calendar.syncedFromExternal'),
      issue: feedIssue(t, entry),
    }))
    .filter((entry) => entry.issue);

  if (!issues.length) return null;

  const hasError = issues.some((entry) => entry.issue.tone === 'error');

  return (
    <div
      className={`rounded-xl px-3 py-2.5 text-xs ${
        hasError ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'
      }`}
    >
      <p className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle size={14} className="flex-shrink-0" />
        {t('calendar.feedIssueTitle')}
      </p>
      <ul className="mt-1.5 space-y-1">
        {issues.map((entry) => (
          <li key={entry.id || entry.label}>
            <span className="font-medium">{entry.label}:</span> {entry.issue.text}
          </li>
        ))}
      </ul>
      <Link to="/settings" className="mt-2 inline-block font-semibold underline">
        {t('calendar.feedIssueSettings')}
      </Link>
    </div>
  );
}
