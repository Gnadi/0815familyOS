import { useContext } from 'react';
import { UIPreferencesContext } from '../context/UIPreferencesContext';

export default function useUIPreferences() {
  return useContext(UIPreferencesContext);
}
