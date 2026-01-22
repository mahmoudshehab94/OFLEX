import { useState, useEffect } from 'react';
import { Truck, Clock } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { DebugPanel } from './DebugPanel';
import { getSupabaseErrorMessage, logDetailedError } from '../lib/errorHandling';

export function DriverSubmission() {
  const [code, setCode] = useState('');
  const [vehicleLetters, setVehicleLetters] = useState('');
  const [vehicleNumbers, setVehicleNumbers] = useState('');
  const [startHour, setStartHour] = useState('05');
  const [startMinute, setStartMinute] = useState('00');
  const [endHour, setEndHour] = useState('14');
  const [endMinute, setEndMinute] = useState('00');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [vehicleError, setVehicleError] = useState('');

  const handleVehicleLettersChange = (value: string) => {
    const letters = value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    setVehicleLetters(letters);
    setVehicleError('');

    if (letters.length === 2 && document.getElementById('vehicleNumbers')) {
      (document.getElementById('vehicleNumbers') as HTMLInputElement)?.focus();
    }
  };

  const handleVehicleNumbersChange = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, '').slice(0, 4);
    setVehicleNumbers(numbers);
    setVehicleError('');
  };

  const handleVehicleNumbersKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && vehicleNumbers === '' && document.getElementById('vehicleLetters')) {
      (document.getElementById('vehicleLetters') as HTMLInputElement)?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setVehicleError('');

    if (!navigator.onLine) {
      setMessage({ type: 'error', text: 'Keine Internetverbindung. Bitte später erneut versuchen.' });
      setLoading(false);
      return;
    }

    if (!vehicleLetters || !vehicleNumbers) {
      setVehicleError('Bitte gültiges Kennzeichen eingeben');
      setLoading(false);
      return;
    }

    const carNumber = `${vehicleLetters} ${vehicleNumbers}`;
    const startTime = `${startHour}:${startMinute}`;
    const endTime = `${endHour}:${endMinute}`;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      const errorMsg = 'Konfigurationsfehler: SUPABASE Umgebungsvariablen fehlen (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).';
      console.error('❌ ' + errorMsg);
      setMessage({ type: 'error', text: errorMsg });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/driver-submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            code: parseInt(code),
            car_number: carNumber,
            start_time: startTime,
            end_time: endTime,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Log submission successful:', data);
        setMessage({
          type: 'success',
          text: `${data.message} - ${data.driver_name}`
        });
        setVehicleLetters('');
        setVehicleNumbers('');
        setStartHour('05');
        setStartMinute('00');
        setEndHour('14');
        setEndMinute('00');
      } else {
        logDetailedError('Log submission failed', { response, data });

        let errorMsg = data.error || 'Ein Fehler ist aufgetreten';

        if (response.status === 401 || response.status === 403) {
          errorMsg = 'Nicht autorisiert (RLS/Policy).';
        }

        setMessage({ type: 'error', text: errorMsg });
      }
    } catch (error: any) {
      logDetailedError('Network error during log submission', error);

      const errorMsg = error.message?.toLowerCase().includes('fetch') ||
                       error.message?.toLowerCase().includes('network') ||
                       error.name === 'TypeError'
        ? 'Netzwerkfehler: Verbindung zu Supabase fehlgeschlagen.'
        : (error.message || 'Verbindungsfehler. Bitte versuchen Sie es erneut.');

      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8 border border-gray-700">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-blue-600 p-3 rounded-full shadow-lg">
            <Truck className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-white mb-2">
          Arbeitszeit erfassen
        </h1>
        <p className="text-center text-gray-300 mb-8">
          Geben Sie Ihre tägliche Arbeitszeit ein
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-200 mb-2">
              Fahrer-Code
            </label>
            <input
              type="number"
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition placeholder-gray-400"
              placeholder="z.B. 1, 2, 3..."
              required
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Kennzeichen
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="text"
                  id="vehicleLetters"
                  value={vehicleLetters}
                  onChange={(e) => handleVehicleLettersChange(e.target.value)}
                  className={`w-full px-4 py-3 bg-gray-700 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-center font-semibold text-lg uppercase text-white placeholder-gray-400 ${
                    vehicleError ? 'border-red-500' : 'border-gray-600'
                  }`}
                  placeholder="MI"
                  maxLength={2}
                  required
                  autoComplete="off"
                />
                <p className="text-xs text-gray-400 mt-1 text-center">Buchstaben</p>
              </div>
              <div>
                <input
                  type="tel"
                  id="vehicleNumbers"
                  value={vehicleNumbers}
                  onChange={(e) => handleVehicleNumbersChange(e.target.value)}
                  onKeyDown={handleVehicleNumbersKeyDown}
                  className={`w-full px-4 py-3 bg-gray-700 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-center font-semibold text-lg text-white placeholder-gray-400 ${
                    vehicleError ? 'border-red-500' : 'border-gray-600'
                  }`}
                  placeholder="299"
                  maxLength={4}
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                />
                <p className="text-xs text-gray-400 mt-1 text-center">Nummer</p>
              </div>
            </div>
            {vehicleError && (
              <p className="text-sm text-red-400 mt-2">{vehicleError}</p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Start
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <select
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-center font-mono text-lg"
                    required
                  >
                    {hours.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1 text-center">Stunde</p>
                </div>
                <div>
                  <select
                    value={startMinute}
                    onChange={(e) => setStartMinute(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-center font-mono text-lg"
                    required
                  >
                    {minutes.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1 text-center">Minute</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Ende
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <select
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-center font-mono text-lg"
                    required
                  >
                    <option value="">--</option>
                    {hours.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1 text-center">Stunde</p>
                </div>
                <div>
                  <select
                    value={endMinute}
                    onChange={(e) => setEndMinute(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-center font-mono text-lg"
                    required
                  >
                    <option value="">--</option>
                    {minutes.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1 text-center">Minute</p>
                </div>
              </div>
            </div>
          </div>

          {message && (
            <div
              className={`p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-900/50 text-green-200 border border-green-700'
                  : 'bg-red-900/50 text-red-200 border border-red-700'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? 'Wird gespeichert...' : 'Arbeitszeit speichern'}
          </button>
        </form>

        <PWAInstallButton />

        <div className="mt-6 text-center">
          <a
            href="/admin"
            className="text-xs text-gray-400 hover:text-gray-200 transition"
          >
            created by - mahmoud shehab
          </a>
        </div>
      </div>

      <DebugPanel />
    </div>
  );
}
