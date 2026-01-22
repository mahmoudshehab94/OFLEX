import { useState, useEffect } from 'react';
import { Truck, Clock } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

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

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/driver-submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
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
        console.error('❌ Log submission failed:', data);
        setMessage({ type: 'error', text: data.error || 'Ein Fehler ist aufgetreten' });
      }
    } catch (error: any) {
      console.error('❌ Network error during log submission:', error);
      setMessage({ type: 'error', text: 'Verbindungsfehler. Bitte versuchen Sie es erneut.' });
    } finally {
      setLoading(false);
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-blue-600 p-3 rounded-full">
            <Truck className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
          Arbeitszeit erfassen
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Geben Sie Ihre tägliche Arbeitszeit ein
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
              Fahrer-Code
            </label>
            <input
              type="number"
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="z.B. 1, 2, 3..."
              required
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kennzeichen
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="text"
                  id="vehicleLetters"
                  value={vehicleLetters}
                  onChange={(e) => handleVehicleLettersChange(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-center font-semibold text-lg uppercase ${
                    vehicleError ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="MI"
                  maxLength={2}
                  required
                  autoComplete="off"
                />
                <p className="text-xs text-gray-500 mt-1 text-center">Buchstaben</p>
              </div>
              <div>
                <input
                  type="tel"
                  id="vehicleNumbers"
                  value={vehicleNumbers}
                  onChange={(e) => handleVehicleNumbersChange(e.target.value)}
                  onKeyDown={handleVehicleNumbersKeyDown}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-center font-semibold text-lg ${
                    vehicleError ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="299"
                  maxLength={4}
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                />
                <p className="text-xs text-gray-500 mt-1 text-center">Nummer</p>
              </div>
            </div>
            {vehicleError && (
              <p className="text-sm text-red-600 mt-2">{vehicleError}</p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Start
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <select
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-center font-mono text-lg"
                    required
                  >
                    {hours.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1 text-center">Stunde</p>
                </div>
                <div>
                  <select
                    value={startMinute}
                    onChange={(e) => setStartMinute(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-center font-mono text-lg"
                    required
                  >
                    {minutes.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1 text-center">Minute</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Ende
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <select
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-center font-mono text-lg"
                    required
                  >
                    <option value="">--</option>
                    {hours.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1 text-center">Stunde</p>
                </div>
                <div>
                  <select
                    value={endMinute}
                    onChange={(e) => setEndMinute(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-center font-mono text-lg"
                    required
                  >
                    <option value="">--</option>
                    {minutes.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1 text-center">Minute</p>
                </div>
              </div>
            </div>
          </div>

          {message && (
            <div
              className={`p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Wird gespeichert...' : 'Arbeitszeit speichern'}
          </button>
        </form>

        <PWAInstallButton />

        <div className="mt-6 text-center">
          <a
            href="/admin"
            className="text-xs text-gray-500 hover:text-gray-700 transition"
          >
            created by - mahmoud shehab
          </a>
        </div>
      </div>
    </div>
  );
}
