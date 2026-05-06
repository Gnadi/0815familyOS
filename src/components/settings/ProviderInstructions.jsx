import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const PROVIDERS = [
  {
    id: 'google',
    label: 'Google Calendar',
    steps: [
      'Open Google Calendar in a browser at calendar.google.com.',
      'In the left sidebar, hover over the calendar you want to share and click the three-dot menu → Settings and sharing.',
      'Scroll all the way down to the Integrate calendar section.',
      'Copy the Secret address in iCal format (the URL ending in .ics). Treat it like a password — anyone with the link can read your events.',
      'Paste the URL into the field below.',
    ],
    note: 'Public address works too if the calendar is already public, but the secret address is the right one for personal calendars.',
  },
  {
    id: 'icloud',
    label: 'iCloud / Apple Calendar',
    steps: [
      'Open icloud.com/calendar in a browser (an iPhone/iPad alone is not enough — you need the web view).',
      'In the sidebar, hover over the calendar you want to share. A small Wi-Fi-style icon appears next to the calendar name — click it.',
      'Tick Public Calendar. iCloud will show a webcal:// URL.',
      'Copy that link. Paste it into the field below — FamilyOS automatically converts webcal:// to https://.',
    ],
    note: 'Apple does not provide private subscription URLs. The calendar must be set to Public for sync to work.',
  },
  {
    id: 'outlook',
    label: 'Outlook / Microsoft 365',
    steps: [
      'Open Outlook on the web at outlook.live.com/calendar (or office.com → Calendar for work accounts).',
      'Settings (the gear icon) → View all Outlook settings → Calendar → Shared calendars.',
      'Under Publish a calendar, pick the calendar and the permission level (events with full details).',
      'Click Publish. Copy the ICS link that appears.',
      'Paste it into the field below.',
    ],
    note: 'Some corporate tenants disable public publishing. If the option is greyed out, ask your admin.',
  },
  {
    id: 'other',
    label: 'Something else',
    steps: [
      'Find the iCal feed URL provided by your calendar app. It usually ends in .ics or starts with webcal://.',
      'Make sure the URL works — paste it into a browser, you should see plain text starting with BEGIN:VCALENDAR.',
      'Paste it into the field below.',
    ],
    note: 'Any tool that can publish a standards-compliant iCal feed (Fastmail, Zoho, Proton Calendar, Nextcloud, …) works.',
  },
];

export default function ProviderInstructions() {
  const [openId, setOpenId] = useState('google');
  return (
    <div className="space-y-2">
      {PROVIDERS.map((p) => {
        const open = openId === p.id;
        return (
          <div key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : p.id)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50"
            >
              <span className="text-sm font-semibold text-slate-900">{p.label}</span>
              <ChevronDown
                size={16}
                className={`text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`}
              />
            </button>
            {open && (
              <div className="space-y-2 px-4 pb-4 text-sm text-slate-700">
                <ol className="list-decimal space-y-1.5 pl-5">
                  {p.steps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
                {p.note && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <strong>Note:</strong> {p.note}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
