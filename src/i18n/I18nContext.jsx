import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setDefaultOptions } from 'date-fns';
import en from './locales/en';
import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  LOCALE_STORAGE_KEY,
  getDateFnsLocale,
  matchLocale,
} from './config';

// English is bundled: it is the pre-render language and the fallback for
// every missing key. Other languages are separate chunks (~25 kB gzip each),
// fetched only by the browsers that use them.
const DICTS = { en };
const LOADERS = {
  de: () => import('./locales/de'),
};
const pending = {};

function loadDict(code) {
  if (DICTS[code]) return Promise.resolve(DICTS[code]);
  if (!LOADERS[code]) return Promise.resolve(DICTS.en);
  pending[code] ??= LOADERS[code]()
    .then((m) => {
      DICTS[code] = m.default;
      return m.default;
    })
    .catch((err) => {
      delete pending[code];
      throw err;
    });
  return pending[code];
}

function preferredLocale() {
  let stored = null;
  try {
    stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  return (
    (LOCALE_CODES.includes(stored) && stored) ||
    matchLocale(window.navigator?.language) ||
    DEFAULT_LOCALE
  );
}

// Start fetching the visitor's language as soon as this module runs, in
// parallel with the rest of startup (auth, Firestore, the route chunk), so it
// is normally in place before the app has anything to show.
if (typeof window !== 'undefined') {
  loadDict(preferredLocale()).catch(() => {});
}

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
    const next = preferredLocale();
    if (next === locale) return;
    let cancelled = false;
    loadDict(next)
      .then(() => {
        if (!cancelled) setLocaleState(next);
      })
      .catch(() => {
        /* chunk failed to load (offline, first visit): stay on English */
      });
    return () => {
      cancelled = true;
    };
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep <html lang>, persistence, and date-fns' global locale in sync. Setting
  // the date-fns default means every format()/formatDistance() call across the
  // app renders weekday and month names in the active language for free.
  // The first run is the hydration default ('en'), not a choice: persisting it
  // would overwrite a stored language whose chunk is still loading (or failed
  // to load offline).
  const persisted = useRef(false);
  useEffect(() => {
    setDefaultOptions({ locale: getDateFnsLocale(locale), weekStartsOn: 1 });
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
    if (!persisted.current) {
      persisted.current = true;
      return;
    }
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      /* storage unavailable */
    }
  }, [locale]);

  const setLocale = useCallback((next) => {
    if (!LOCALE_CODES.includes(next)) return;
    loadDict(next)
      .then(() => setLocaleState(next))
      .catch(() => {});
  }, []);

  // t('key', { vars }) — looks up the active language, falls back to English,
  // then to the raw key so a missing translation is visible but never crashes.
  const t = useCallback(
    (key, vars) => {
      const value = lookup(DICTS[locale] || DICTS.en, key) ?? lookup(DICTS.en, key) ?? key;
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
        lookup(DICTS[locale] || DICTS.en, key + suffix) ??
        lookup(DICTS.en, key + suffix) ??
        lookup(DICTS[locale] || DICTS.en, key) ??
        lookup(DICTS.en, key) ??
        key;
      return interpolate(value, merged);
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t, tn }), [locale, setLocale, t, tn]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
