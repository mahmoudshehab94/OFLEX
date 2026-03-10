import { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { DriverSubmission } from './components/DriverSubmission';
import { SupervisorDashboard } from './components/SupervisorDashboard';
import { AdminLogin } from './components/AdminLogin';
import AdminDashboardV2 from './components/AdminDashboardV2';

function AppContent() {
  const { user, loading } = useAuth();

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/admin' && user?.role !== 'admin') {
      window.history.pushState({}, '', '/');
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  const path = window.location.pathname;
  if (path === '/admin') {
    const isOldAdminLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
    if (isOldAdminLoggedIn) {
      const handleOldAdminLogout = () => {
        localStorage.removeItem('adminLoggedIn');
        window.history.pushState({}, '', '/');
        window.location.reload();
      };
      return <AdminDashboardV2 onLogout={handleOldAdminLogout} />;
    }
    return <AdminLogin onLogin={() => {
      window.history.pushState({}, '', '/admin');
      window.location.reload();
    }} />;
  }

  if (!user) {
    return <Login />;
  }

  if (user.role === 'admin') {
    return <AdminDashboardV2 onLogout={async () => {
      const { logout } = useAuth();
      await logout();
    }} />;
  }

  if (user.role === 'supervisor') {
    return <SupervisorDashboard />;
  }

  if (user.role === 'driver') {
    return <DriverSubmission />;
  }

  return <Login />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
