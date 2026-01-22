import { useState, useEffect } from 'react';
import { DriverSubmission } from './components/DriverSubmission';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';

function App() {
  const [page, setPage] = useState<'driver' | 'admin-login' | 'admin-dashboard'>('driver');
  const [adminToken, setAdminToken] = useState<string | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/admin') {
      const token = localStorage.getItem('adminToken');
      if (token) {
        setAdminToken(token);
        setPage('admin-dashboard');
      } else {
        setPage('admin-login');
      }
    } else {
      setPage('driver');
    }

    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/admin') {
        const token = localStorage.getItem('adminToken');
        if (token) {
          setAdminToken(token);
          setPage('admin-dashboard');
        } else {
          setPage('admin-login');
        }
      } else {
        setPage('driver');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleAdminLogin = (token: string) => {
    setAdminToken(token);
    setPage('admin-dashboard');
    window.history.pushState({}, '', '/admin');
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    setAdminToken(null);
    setPage('driver');
    window.history.pushState({}, '', '/');
  };

  if (page === 'admin-login') {
    return <AdminLogin onLogin={handleAdminLogin} />;
  }

  if (page === 'admin-dashboard' && adminToken) {
    return <AdminDashboard onLogout={handleAdminLogout} authToken={adminToken} />;
  }

  return <DriverSubmission />;
}

export default App;
