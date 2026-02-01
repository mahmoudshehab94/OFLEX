import { useState } from 'react';
import { Lock } from 'lucide-react';
import { supabase, hasSupabaseConfig } from '../lib/supabase';

interface AdminLoginProps {
  onLogin: () => void;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!hasSupabaseConfig || !supabase) {
      setError('Konfigurationsfehler: Fehlende Supabase-Umgebungsvariablen');
      setLoading(false);
      return;
    }

    try {
      const fixedId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const { data: dbSettings } = await supabase
        .from('admin_settings')
        .select('password')
        .eq('id', fixedId)
        .maybeSingle();

      let correctPassword = import.meta.env.VITE_ADMIN_PASSWORD;

      if (dbSettings && dbSettings.password) {
        correctPassword = dbSettings.password;
      }

      if (!correctPassword) {
        setError('Konfigurationsfehler: VITE_ADMIN_PASSWORD nicht gesetzt');
        setLoading(false);
        return;
      }

      if (password === correctPassword) {
        localStorage.setItem('adminLoggedIn', 'true');
        onLogin();
      } else {
        setError('Falsches Passwort');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(`Fehler: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-8 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-blue-600 p-3 rounded-full">
            <Lock className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2">
          Admin-Bereich
        </h1>
        <p className="text-center text-slate-600 dark:text-gray-300 mb-8">
          Bitte melden Sie sich an
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-2">
              Benutzername
            </label>
            <input
              type="text"
              id="username"
              value="admin"
              className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400 rounded-lg"
              disabled
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-2">
              Passwort
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/50 dark:text-red-200 dark:border-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Anmeldung läuft...' : 'Anmelden'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
          >
            Zurück zur Startseite
          </a>
        </div>

        <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          created by - mahmoud shehab
        </div>
      </div>
    </div>
  );
}
