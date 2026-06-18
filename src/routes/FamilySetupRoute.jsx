import ProtectedRoute from './ProtectedRoute';
import FamilySetupPage from '../pages/FamilySetupPage';

// Auth-protected but NOT family-gated (this is where a user joins/creates a
// family). Lazily loaded so FamilySetupPage's Firebase service imports stay
// out of the static pre-render.
export default function FamilySetupRoute() {
  return (
    <ProtectedRoute>
      <FamilySetupPage />
    </ProtectedRoute>
  );
}
