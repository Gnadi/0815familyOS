import { useContext } from 'react';
import { I18nContext } from '../i18n/I18nContext';

// Primary translation hook. Returns { t, tn, locale, setLocale }.
//   t('calendar.familyCalendar')              → "Family Calendar"
//   t('dashboard.greeting', { name: 'Alex' }) → "Hi, Alex"
//   tn('vault.docCount', 3)                   → "3 documents" / "1 document"
export default function useT() {
  return useContext(I18nContext);
}
