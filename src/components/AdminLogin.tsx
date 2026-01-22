import { useState } from 'react';
import { Lock } from 'lucide-react';
import { DebugPanel } from './DebugPanel';
import { logDetailedError } from '../lib/errorHandling';

interface AdminLoginProps {
  onLogin: (token: string) => void;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      const errorMsg = 'Konfigurationsfehler: SUPABASE Umgebungsvariablen fehlen (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).';
      console.error('❌ ' + errorMsg);
      setError(errorMsg);
      setLoading(false);
      return;
    }

    try {
      const apiUrl = `${supabaseUrl}/functions/v1/admin-auth`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        logDetailedError('Admin login failed', { response, data });

        let errorMsg = data.error || 'Anmeldung fehlgeschlagen';

        if (response.status === 401 || response.status === 403) {
          errorMsg = 'Nicht autorisiert (RLS/Policy).';
        }

        setError(errorMsg);
        setLoading(false);
        return;
      }

      if (data.success && data.token) {
        localStorage.setItem('adminToken', data.token);
        onLogin(data.token);
      } else {
        setError('Anmeldung fehlgeschlagen');
      }
    } catch (err: any) {
      logDetailedError('Admin login network error', err);

      const errorMsg = err.message?.toLowerCase().includes('fetch') ||
                       err.message?.toLowerCase().includes('network') ||
                       err.name === 'TypeError'
        ? 'Netzwerkfehler: Verbindung zu Supabase fehlgeschlagen.'
        : (err.message || 'Verbindungsfehler. Bitte versuchen Sie es erneut.');

      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-slate-800 p-3 rounded-full">
            <Lock className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
          Admin-Bereich
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Bitte melden Sie sich an
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Benutzername
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-50 text-red-800 border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-800 text-white py-3 px-6 rounded-lg font-medium hover:bg-slate-900 focus:ring-4 focus:ring-slate-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Anmeldung läuft...' : 'Anmelden'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-sm text-gray-600 hover:text-slate-800 transition"
          >
            Zurück zur Startseite
          </a>
        </div>
      </div>

      <DebugPanel />
    </div>
  );
}
