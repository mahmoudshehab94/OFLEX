import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { DriverSubmission } from './components/DriverSubmission';
import { AdminLogin } from './components/AdminLogin';
import AdminDashboardV2 from './components/AdminDashboardV2';
import { SupervisorDashboard } from './components/SupervisorDashboard';
import { RegisterWithInvite } from './components/RegisterWithInvite';
import { ProtectedRoute } from './components/ProtectedRoute';

type RouteType = 'login' | 'register' | 'admin-login' | 'driver' | 'admin-dashboard' | 'supervisor-dashboard';

function AppContent() {
  const { user, loading, logout } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<RouteType>('login');

  useEffect(() => {
    const path = window.location.pathname;

    if (loading) return;

    if (path === '/register') {
      setCurrentRoute('register');
      return;
    }

    if (path === '/admin') {
      const isOldAdminLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
      if (isOldAdminLoggedIn || !user) {
        setCurrentRoute('admin-login');
        return;
      }

      if (user && user.role !== 'admin') {
        const redirectPath = getDefaultPathForRole(user.role);
        window.history.pushState({}, '', redirectPath);
        window.location.reload();
        return;
      }
    }

    if (!user) {
      if (path !== '/' && path !== '/admin') {
        window.history.pushState({}, '', '/');
      }
      setCurrentRoute('login');
      return;
    }

    if (user.role === 'driver') {
      if (path !== '/driver' && path !== '/') {
        window.history.pushState({}, '', '/driver');
        window.location.reload();
        return;
      }
      setCurrentRoute('driver');
    } else if (user.role === 'admin') {
      if (path !== '/dashboard' && path !== '/' && path !== '/admin') {
        window.history.pushState({}, '', '/dashboard');
        window.location.reload();
        return;
      }
      setCurrentRoute('admin-dashboard');
    } else if (user.role === 'supervisor') {
      if (path !== '/dashboard' && path !== '/' && path !== '/admin') {
        window.history.pushState({}, '', '/dashboard');
        window.location.reload();
        return;
      }
      setCurrentRoute('supervisor-dashboard');
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (currentRoute === 'register') {
    return <RegisterWithInvite />;
  }

  if (currentRoute === 'admin-login') {
    const isOldAdminLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
    if (isOldAdminLoggedIn) {
      const handleOldAdminLogout = () => {
        localStorage.removeItem('adminLoggedIn');
        window.history.pushState({}, '', '/');
        window.location.reload();
      };
      return (
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDashboardV2 onLogout={handleOldAdminLogout} />
        </ProtectedRoute>
      );
    }
    return <AdminLogin onLogin={() => {
      window.history.pushState({}, '', '/admin');
      window.location.reload();
    }} />;
  }

  if (!user) {
    return <Login />;
  }

  if (currentRoute === 'driver') {
    return (
      <ProtectedRoute allowedRoles={['driver']}>
        <DriverSubmission />
      </ProtectedRoute>
    );
  }

  if (currentRoute === 'admin-dashboard') {
    return (
      <ProtectedRoute allowedRoles={['admin']}>
        <AdminDashboardV2 onLogout={logout} />
      </ProtectedRoute>
    );
  }

  if (currentRoute === 'supervisor-dashboard') {
    return (
      <ProtectedRoute allowedRoles={['supervisor']}>
        <SupervisorDashboard />
      </ProtectedRoute>
    );
  }

  return <Login />;
}

function getDefaultPathForRole(role: 'admin' | 'supervisor' | 'driver'): string {
  switch (role) {
    case 'admin':
    case 'supervisor':
      return '/dashboard';
    case 'driver':
      return '/driver';
    default:
      return '/';
  }
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
