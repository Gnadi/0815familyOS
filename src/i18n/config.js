// Central list of supported languages. Adding a new language is a two-step job:
//   1. create src/i18n/locales/<code>.js (copy en.js and translate the values)
//   2. register it here with its date-fns locale
// Everything else (the language picker, persistence, <html lang>, date
// formatting) is driven off this list.
import { enUS, de } from 'date-fns/locale';

export const LOCALES = [
  { code: 'en', label: 'English',  nativeLabel: 'English',  flag: '🇬🇧', dateFns: enUS },
  { code: 'de', label: 'German',   nativeLabel: 'Deutsch',  flag: '🇩🇪', dateFns: de },
];

export const LOCALE_CODES = LOCALES.map((l) => l.code);

// English is the source language: it is rendered during pre-rendering and on
// the first client paint (so the static HTML and hydration always match), then
// the stored / browser-detected language is applied in an effect after mount.
export const DEFAULT_LOCALE = 'en';

export const LOCALE_STORAGE_KEY = 'familyos:locale';

export function getDateFnsLocale(code) {
  return (LOCALES.find((l) => l.code === code) || LOCALES[0]).dateFns;
}

// Pick the best supported language for a raw navigator string like "de-AT".
export function matchLocale(raw) {
  if (!raw) return null;
  const lower = String(raw).toLowerCase();
  const exact = LOCALE_CODES.find((c) => c === lower);
  if (exact) return exact;
  const base = lower.split('-')[0];
  return LOCALE_CODES.find((c) => c === base) || null;
}
