import { ReactNode, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: ('admin' | 'supervisor' | 'driver')[];
  redirectTo?: string;
}

export function ProtectedRoute({ children, allowedRoles, redirectTo = '/' }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && !allowedRoles.includes(user.role)) {
      const targetPath = getDefaultPathForRole(user.role);
      window.history.pushState({}, '', targetPath);
      window.location.reload();
    }
  }, [user, loading, allowedRoles]);

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

  if (!user) {
    window.history.pushState({}, '', redirectTo);
    window.location.reload();
    return null;
  }

  if (!allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
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
