import { useState, useEffect } from 'react';
import { DriverSubmission } from './components/DriverSubmission';
import { AdminLogin } from './components/AdminLogin';
import AdminDashboardFull from './components/AdminDashboardFull';
import { ThemeToggle } from './components/ThemeToggle';

function App() {
  const [page, setPage] = useState<'driver' | 'admin-login' | 'admin-dashboard'>('driver');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

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

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (storedTheme === 'dark' || storedTheme === 'light') {
      setTheme(storedTheme);
    } else {
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleAdminLogin = () => {
    setPage('admin-dashboard');
    window.history.pushState({}, '', '/admin');
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminLoggedIn');
    setPage('driver');
    window.history.pushState({}, '', '/');
  };

  let content: JSX.Element;

  if (page === 'admin-login') {
    content = <AdminLogin onLogin={handleAdminLogin} />;
  } else if (page === 'admin-dashboard') {
    content = <AdminDashboardFull onLogout={handleAdminLogout} />;
  } else {
    content = <DriverSubmission />;
  }

  return (
    <>
      {content}
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
    </>
  );
}

export default App;
