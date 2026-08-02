import RootLayout from './components/layout/RootLayout';
import LandingPage from './pages/LandingPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';

// Adapts a `() => import('./Page')` (default export = component) into the
// React Router `lazy` shape (`{ Component }`). Keeping the protected/auth
// routes lazy means their browser-only dependencies are never evaluated
// during the Node pre-render of the public landing page.
const lazyDefault = (factory) => () =>
  factory().then((m) => ({ Component: m.default }));

// Route tree consumed by ViteReactSSG. Only `/` (LandingPage) is pre-rendered
// to static HTML (see `ssgOptions.includedRoutes` in vite.config.js); every
// other route stays client-side.
export const routes = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      // Static-imported (not lazy) like the landing page so both legal pages
      // can be pre-rendered to static HTML during the SSG build.
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'login', lazy: lazyDefault(() => import('./pages/LoginPage')) },
      { path: 'signup', lazy: lazyDefault(() => import('./pages/SignupPage')) },
      {
        path: 'family-setup',
        lazy: lazyDefault(() => import('./routes/FamilySetupRoute')),
      },
      // Invite links. Deliberately outside the protected layout: the page has
      // to render for signed-out visitors, and FamilyGate would redirect a
      // user without a family before they saw the invitation. The dynamic
      // segment keeps it out of the SSG pass, so it is served by app.html.
      { path: 'join/:token', lazy: lazyDefault(() => import('./pages/JoinPage')) },
      {
        lazy: lazyDefault(() => import('./routes/ProtectedAppLayout')),
        children: [
          { path: 'dashboard', lazy: lazyDefault(() => import('./pages/DashboardPage')) },
          { path: 'calendar', lazy: lazyDefault(() => import('./pages/CalendarPage')) },
          { path: 'tasks', lazy: lazyDefault(() => import('./pages/TasksPage')) },
          { path: 'meals', lazy: lazyDefault(() => import('./pages/FoodPage')) },
          { path: 'vault', lazy: lazyDefault(() => import('./pages/DocumentVaultPage')) },
          { path: 'gifts', lazy: lazyDefault(() => import('./pages/GiftPlannerPage')) },
          { path: 'settings', lazy: lazyDefault(() => import('./pages/SettingsPage')) },
          { path: 'health', lazy: lazyDefault(() => import('./pages/VaccinationPage')) },
          { path: 'shopping', lazy: lazyDefault(() => import('./pages/ShoppingPage')) },
        ],
      },
      { path: '*', element: <LandingPage /> },
    ],
  },
];
