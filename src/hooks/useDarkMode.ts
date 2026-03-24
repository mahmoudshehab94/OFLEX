import { useEffect, useState } from 'react';

export function useDarkMode() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('trans-oflex-dark-mode');
    if (saved !== null) {
      const dark = JSON.parse(saved);
      setIsDark(dark);
      applyTheme(dark);
    } else {
      setIsDark(true);
      applyTheme(true);
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDark(prev => {
      const newValue = !prev;
      localStorage.setItem('trans-oflex-dark-mode', JSON.stringify(newValue));
      applyTheme(newValue);
      return newValue;
    });
  };

  const applyTheme = (dark: boolean) => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return { isDark, toggleDarkMode };
}
