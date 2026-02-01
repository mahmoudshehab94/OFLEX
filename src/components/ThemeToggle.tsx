import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="fixed right-4 top-4 z-50 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-lg transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      aria-label={theme === 'dark' ? 'Zu hellem Modus wechseln' : 'Zu dunklem Modus wechseln'}
    >
      {theme === 'dark' ? (
        <>
          <Sun className="h-4 w-4" />
          Hell
        </>
      ) : (
        <>
          <Moon className="h-4 w-4" />
          Dunkel
        </>
      )}
    </button>
  );
}
