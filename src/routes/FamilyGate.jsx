import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import Spinner from '../components/common/Spinner';

export default function FamilyGate({ children }) {
  const { userDoc, loading } = useAuth();
  if (loading || !userDoc) return <Spinner fullscreen />;
  if (!userDoc.familyId) return <Navigate to="/family-setup" replace />;
  return children;
}
