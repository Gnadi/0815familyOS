import { useContext } from 'react';
import { I18nContext } from '../i18n/I18nContext';

// Primary translation hook. Returns { t, tn, locale, setLocale }.
//   t('calendar.title')                       → "Calendar"
//   t('dashboard.greeting', { name: 'Alex' }) → "Hi, Alex"
//   tn('tasks.count', 3)                       → "3 tasks" / "1 task"
export default function useT() {
  return useContext(I18nContext);
}
