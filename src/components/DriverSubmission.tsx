import { useState } from 'react';
import { Truck, Clock } from 'lucide-react';
import { supabase, hasSupabaseConfig } from '../lib/supabase';
import { PWAInstallButton } from './PWAInstallButton';

export function DriverSubmission() {
  const [driverCode, setDriverCode] = useState('');
  const [licenseLetters, setLicenseLetters] = useState('');
  const [licenseNumbers, setLicenseNumbers] = useState('');
  const [startHour, setStartHour] = useState('05');
  const [startMinute, setStartMinute] = useState('00');
  const [endHour, setEndHour] = useState('14');
  const [endMinute, setEndMinute] = useState('00');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleLicenseLettersChange = (value: string) => {
    const letters = value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    setLicenseLetters(letters);

    if (letters.length === 2 && document.getElementById('licenseNumbers')) {
      (document.getElementById('licenseNumbers') as HTMLInputElement)?.focus();
    }
  };

  const handleLicenseNumbersChange = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, '').slice(0, 4);
    setLicenseNumbers(numbers);
  };

  const handleLicenseNumbersKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && licenseNumbers === '' && document.getElementById('licenseLetters')) {
      (document.getElementById('licenseLetters') as HTMLInputElement)?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!hasSupabaseConfig || !supabase) {
      setMessage({
        type: 'error',
        text: 'Config error: missing Supabase env vars'
      });
      setLoading(false);
      return;
    }

    if (!licenseLetters || !licenseNumbers) {
      setMessage({ type: 'error', text: 'Bitte gültiges Kennzeichen eingeben' });
      setLoading(false);
      return;
    }

    const startTime = `${startHour}:${startMinute}`;
    const endTime = `${endHour}:${endMinute}`;

    try {
      const { data: driver, error: driverError } = await supabase
        .from('drivers')
        .select('id')
        .eq('driver_code', driverCode)
        .eq('license_letters', licenseLetters)
        .eq('license_numbers', licenseNumbers)
        .maybeSingle();

      if (driverError) {
        console.error('Driver lookup error:', driverError);
        setMessage({
          type: 'error',
          text: `Fehler beim Abrufen des Fahrers: ${driverError.message}`
        });
        setLoading(false);
        return;
      }

      let driverId: string;

      if (!driver) {
        const { data: newDriver, error: createError } = await supabase
          .from('drivers')
          .insert({
            driver_code: driverCode,
            license_letters: licenseLetters,
            license_numbers: licenseNumbers
          })
          .select('id')
          .single();

        if (createError || !newDriver) {
          console.error('Driver creation error:', createError);
          setMessage({
            type: 'error',
            text: `Fehler beim Erstellen des Fahrers: ${createError?.message}`
          });
          setLoading(false);
          return;
        }

        driverId = newDriver.id;
      } else {
        driverId = driver.id;
      }

      const { error: workTimeError } = await supabase
        .from('work_times')
        .insert({
          driver_id: driverId,
          start_time: startTime,
          end_time: endTime,
          work_date: new Date().toISOString().split('T')[0]
        });

      if (workTimeError) {
        console.error('Work time insertion error:', workTimeError);
        setMessage({
          type: 'error',
          text: `Fehler beim Speichern: ${workTimeError.message}`
        });
        setLoading(false);
        return;
      }

      setMessage({
        type: 'success',
        text: `Arbeitszeit erfolgreich gespeichert!`
      });

      setDriverCode('');
      setLicenseLetters('');
      setLicenseNumbers('');
      setStartHour('05');
      setStartMinute('00');
      setEndHour('14');
      setEndMinute('00');
    } catch (error: any) {
      console.error('Submission error:', error);
      setMessage({
        type: 'error',
        text: `Fehler: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  if (!hasSupabaseConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 flex items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 max-w-md">
          <h2 className="text-red-400 font-bold text-xl mb-2">Configuration Error</h2>
          <p className="text-red-300">
            Missing Supabase environment variables. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.
          </p>
        </div>
      </div>
    );
  }

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
            <label htmlFor="driverCode" className="block text-sm font-medium text-gray-200 mb-2">
              Fahrer-Code
            </label>
            <input
              type="text"
              id="driverCode"
              value={driverCode}
              onChange={(e) => setDriverCode(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition placeholder-gray-400"
              placeholder="z.B. D001, D002..."
              required
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
                  id="licenseLetters"
                  value={licenseLetters}
                  onChange={(e) => handleLicenseLettersChange(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-center font-semibold text-lg uppercase text-white placeholder-gray-400"
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
                  id="licenseNumbers"
                  value={licenseNumbers}
                  onChange={(e) => handleLicenseNumbersChange(e.target.value)}
                  onKeyDown={handleLicenseNumbersKeyDown}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-center font-semibold text-lg text-white placeholder-gray-400"
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
    </div>
  );
}
