import ProtectedRoute from './ProtectedRoute';
import FamilyGate from './FamilyGate';
import AppShell from '../components/layout/AppShell';

// Layout for the authenticated, family-gated app area. Lazily loaded so its
// heavy, browser-only dependencies (AppShell, dnd-kit, jspdf, Firebase
// services, …) are never imported during the Node pre-render of the public
// landing page. AppShell renders an <Outlet /> for the nested feature routes.
export default function ProtectedAppLayout() {
  return (
    <ProtectedRoute>
      <FamilyGate>
        <AppShell />
      </FamilyGate>
    </ProtectedRoute>
  );
}
