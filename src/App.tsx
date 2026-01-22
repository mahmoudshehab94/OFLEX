import { useState, useEffect } from 'react';
import { DriverSubmission } from './components/DriverSubmission';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import Diagnostics from './components/Diagnostics';

function App() {
  const [page, setPage] = useState<'driver' | 'admin-login' | 'admin-dashboard'>('driver');

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/admin') {
      const isLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
      if (isLoggedIn) {
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
        const isLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
        if (isLoggedIn) {
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

  const handleAdminLogin = () => {
    setPage('admin-dashboard');
    window.history.pushState({}, '', '/admin');
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminLoggedIn');
    setPage('driver');
    window.history.pushState({}, '', '/');
  };

  if (page === 'admin-login') {
    return <AdminLogin onLogin={handleAdminLogin} />;
  }

  if (page === 'admin-dashboard') {
    return (
      <>
        <AdminDashboard onLogout={handleAdminLogout} />
        <Diagnostics />
      </>
    );
  }

  return (
    <>
      <DriverSubmission />
      <Diagnostics />
    </>
  );
}

export default App;
