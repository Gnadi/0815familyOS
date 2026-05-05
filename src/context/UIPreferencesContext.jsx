import { createContext, useEffect, useMemo, useState } from 'react';

export const THEMES = [
  { id: 'blue',    label: 'Blue',    swatch: '#3B82F6' },
  { id: 'emerald', label: 'Emerald', swatch: '#10B981' },
  { id: 'rose',    label: 'Rose',    swatch: '#F43F5E' },
  { id: 'violet',  label: 'Violet',  swatch: '#8B5CF6' },
  { id: 'amber',   label: 'Amber',   swatch: '#F59E0B' },
];

const THEME_IDS = THEMES.map((t) => t.id);
const MODES = ['light', 'dark'];

const THEME_KEY = 'familyos:theme';
const MODE_KEY = 'familyos:mode';
const LABELS_KEY = 'familyos:showLabels';

export const UIPreferencesContext = createContext({
  theme: 'blue',
  setTheme: () => {},
  mode: 'light',
  setMode: () => {},
  showLabels: true,
  setShowLabels: () => {},
});

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

function readShowLabels() {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(LABELS_KEY);
  return stored === null ? true : stored === 'true';
}

export function UIPreferencesProvider({ children }) {
  const [theme, setThemeState] = useState(readTheme);
  const [mode, setModeState] = useState(readMode);
  const [showLabels, setShowLabelsState] = useState(readShowLabels);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    window.localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    window.localStorage.setItem(LABELS_KEY, String(showLabels));
  }, [showLabels]);

  function setTheme(next) {
    if (THEME_IDS.includes(next)) setThemeState(next);
  }

  function setMode(next) {
    if (MODES.includes(next)) setModeState(next);
  }

  const value = useMemo(
    () => ({ theme, setTheme, mode, setMode, showLabels, setShowLabels: setShowLabelsState }),
    [theme, mode, showLabels],
  );

  return (
    <UIPreferencesContext.Provider value={value}>
      {children}
    </UIPreferencesContext.Provider>
  );
}
