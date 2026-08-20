import { createContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_QUICK_ACCESS,
  LEGACY_QUICK_ACCESS_IDS,
  QUICK_ACCESS_IDS,
} from '../constants/quickAccessEntries';
import { resolveQuickAccess, sanitizeQuickAccess as sanitize } from '../utils/quickAccess';

export const THEMES = [
  { id: 'blue',    label: 'Blue',    swatch: '#3B82F6' },
  { id: 'emerald', label: 'Emerald', swatch: '#10B981' },
  { id: 'rose',    label: 'Rose',    swatch: '#F43F5E' },
  { id: 'violet',  label: 'Violet',  swatch: '#8B5CF6' },
  { id: 'amber',   label: 'Amber',   swatch: '#F59E0B' },
];

export const SKINS = [
  { id: 'material', label: 'Material' },
  { id: 'ios',      label: 'iOS' },
];

const THEME_IDS = THEMES.map((t) => t.id);
const SKIN_IDS = SKINS.map((s) => s.id);
const MODES = ['light', 'dark'];

const THEME_KEY = 'familyos:theme';
const MODE_KEY = 'familyos:mode';
const SKIN_KEY = 'familyos:skin';
const LABELS_KEY = 'familyos:showLabels';
const QUICK_ACCESS_KEY = 'familyos:quickAccess';
// The shortcut ids this install has already offered the user; see
// src/utils/quickAccess.js for why a second key is needed.
const QUICK_ACCESS_SEEN_KEY = 'familyos:quickAccessSeen';

export const UIPreferencesContext = createContext({
  theme: 'blue',
  setTheme: () => {},
  mode: 'light',
  setMode: () => {},
  skin: 'material',
  setSkin: () => {},
  showLabels: true,
  setShowLabels: () => {},
  quickAccess: DEFAULT_QUICK_ACCESS,
  setQuickAccess: () => {},
});

const sanitizeQuickAccess = (list) => sanitize(list, QUICK_ACCESS_IDS);

function parse(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function readTheme() {
  if (typeof window === 'undefined') return 'blue';
  const stored = window.localStorage.getItem(THEME_KEY);
  return THEME_IDS.includes(stored) ? stored : 'blue';
}

function readMode() {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(MODE_KEY);
  return MODES.includes(stored) ? stored : 'light';
}

function readSkin() {
  if (typeof window === 'undefined') return 'material';
  const stored = window.localStorage.getItem(SKIN_KEY);
  return SKIN_IDS.includes(stored) ? stored : 'material';
}

function readShowLabels() {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(LABELS_KEY);
  return stored === null ? true : stored === 'true';
}

function readQuickAccess() {
  if (typeof window === 'undefined') return DEFAULT_QUICK_ACCESS;
  return resolveQuickAccess({
    stored: parse(QUICK_ACCESS_KEY),
    seen: parse(QUICK_ACCESS_SEEN_KEY),
    allIds: QUICK_ACCESS_IDS,
    defaults: DEFAULT_QUICK_ACCESS,
    legacyIds: LEGACY_QUICK_ACCESS_IDS,
  });
}

export function UIPreferencesProvider({ children }) {
  const [theme, setThemeState] = useState(readTheme);
  const [mode, setModeState] = useState(readMode);
  const [skin, setSkinState] = useState(readSkin);
  const [showLabels, setShowLabelsState] = useState(readShowLabels);
  const [quickAccess, setQuickAccessState] = useState(readQuickAccess);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    window.localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    document.documentElement.dataset.skin = skin;
    window.localStorage.setItem(SKIN_KEY, skin);
  }, [skin]);

  useEffect(() => {
    window.localStorage.setItem(LABELS_KEY, String(showLabels));
  }, [showLabels]);

  useEffect(() => {
    window.localStorage.setItem(QUICK_ACCESS_KEY, JSON.stringify(quickAccess));
    // Recording the whole catalogue — not just the visible shortcuts — is what
    // stops a removed shortcut from being re-offered on every load.
    window.localStorage.setItem(QUICK_ACCESS_SEEN_KEY, JSON.stringify(QUICK_ACCESS_IDS));
  }, [quickAccess]);

  function setTheme(next) {
    if (THEME_IDS.includes(next)) setThemeState(next);
  }

  function setMode(next) {
    if (MODES.includes(next)) setModeState(next);
  }

  function setSkin(next) {
    if (SKIN_IDS.includes(next)) setSkinState(next);
  }

  function setQuickAccess(next) {
    const sanitized = sanitizeQuickAccess(next);
    if (sanitized) setQuickAccessState(sanitized);
  }

  const value = useMemo(
    () => ({
      theme, setTheme, mode, setMode, skin, setSkin,
      showLabels, setShowLabels: setShowLabelsState,
      quickAccess, setQuickAccess,
    }),
    [theme, mode, skin, showLabels, quickAccess],
  );

  return (
    <UIPreferencesContext.Provider value={value}>
      {children}
    </UIPreferencesContext.Provider>
  );
}
