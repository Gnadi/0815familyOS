import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import FamilyGate from './routes/FamilyGate';
import AppShell from './components/layout/AppShell';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import FamilySetupPage from './pages/FamilySetupPage';
import DashboardPage from './pages/DashboardPage';
import CalendarPage from './pages/CalendarPage';
import TasksPage from './pages/TasksPage';
import SettingsPage from './pages/SettingsPage';
import DocumentVaultPage from './pages/DocumentVaultPage';
import GiftPlannerPage from './pages/GiftPlannerPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/family-setup"
          element={
            <ProtectedRoute>
              <FamilySetupPage />
            </ProtectedRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <FamilyGate>
                <AppShell />
              </FamilyGate>
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/vault" element={<DocumentVaultPage />} />
          <Route path="/gifts" element={<GiftPlannerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </AuthProvider>
  );
}
