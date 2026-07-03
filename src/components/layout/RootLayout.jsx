import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { UIPreferencesProvider } from '../../context/UIPreferencesContext';
import { AuthProvider } from '../../context/AuthContext';
import { I18nProvider } from '../../i18n/I18nContext';
import InstallPrompt from '../pwa/InstallPrompt';
import registerSW from '../../utils/registerSW';

// Root layout for every route. Holds the app-wide providers that previously
// lived in main.jsx / App.jsx so the route tree (consumed by vite-react-ssg)
// is wrapped consistently during both pre-rendering and client hydration.
export default function RootLayout() {
  // Register the service worker once, client-side, after hydration.
  useEffect(() => {
    registerSW();
  }, []);

  return (
    <I18nProvider>
      <UIPreferencesProvider>
        <AuthProvider>
          <Outlet />
          <InstallPrompt />
        </AuthProvider>
      </UIPreferencesProvider>
    </I18nProvider>
  );
}
