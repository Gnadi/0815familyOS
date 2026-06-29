import { Outlet } from 'react-router-dom';
import { UIPreferencesProvider } from '../../context/UIPreferencesContext';
import { AuthProvider } from '../../context/AuthContext';
import { I18nProvider } from '../../i18n/I18nContext';

// Root layout for every route. Holds the app-wide providers that previously
// lived in main.jsx / App.jsx so the route tree (consumed by vite-react-ssg)
// is wrapped consistently during both pre-rendering and client hydration.
export default function RootLayout() {
  return (
    <I18nProvider>
      <UIPreferencesProvider>
        <AuthProvider>
          <Outlet />
        </AuthProvider>
      </UIPreferencesProvider>
    </I18nProvider>
  );
}
