import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { setDefaultOptions } from 'date-fns';
import en from './locales/en';
import de from './locales/de';
import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  LOCALE_STORAGE_KEY,
  getDateFnsLocale,
  matchLocale,
} from './config';

const DICTS = { en, de };

// Resolve a dotted key ("calendar.title") against a nested dictionary object.
function lookup(dict, key) {
  return key.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), dict);
}

// Replace {name} placeholders with values from `vars`.
function interpolate(template, vars) {
  if (!vars || typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    vars[name] != null ? String(vars[name]) : match,
  );
}

export const I18nContext = createContext({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
  tn: (key) => key,
});

export function I18nProvider({ children }) {
  // Always start from the default language so server-rendered HTML and the
  // first client render are identical (no hydration mismatch). The stored /
  // browser language is applied in the effect below, after hydration.
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    const next =
      (LOCALE_CODES.includes(stored) && stored) ||
      matchLocale(window.navigator?.language) ||
      DEFAULT_LOCALE;
    if (next !== locale) setLocaleState(next);
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep <html lang>, persistence, and date-fns' global locale in sync. Setting
  // the date-fns default means every format()/formatDistance() call across the
  // app renders weekday and month names in the active language for free.
  useEffect(() => {
    setDefaultOptions({ locale: getDateFnsLocale(locale), weekStartsOn: 1 });
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
    if (typeof window !== 'undefined')
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = useCallback((next) => {
    if (LOCALE_CODES.includes(next)) setLocaleState(next);
  }, []);

  // t('key', { vars }) — looks up the active language, falls back to English,
  // then to the raw key so a missing translation is visible but never crashes.
  const t = useCallback(
    (key, vars) => {
      const value = lookup(DICTS[locale], key) ?? lookup(DICTS.en, key) ?? key;
      return interpolate(value, vars);
    },
    [locale],
  );

  // tn('key', count, { vars }) — picks "<key>_one" vs "<key>_other" and exposes
  // {count} to the template. German and English share the same one/other split.
  const tn = useCallback(
    (key, count, vars) => {
      const suffix = count === 1 ? '_one' : '_other';
      const merged = { ...vars, count };
      const value =
        lookup(DICTS[locale], key + suffix) ??
        lookup(DICTS.en, key + suffix) ??
        lookup(DICTS[locale], key) ??
        lookup(DICTS.en, key) ??
        key;
      return interpolate(value, merged);
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t, tn }), [locale, setLocale, t, tn]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
