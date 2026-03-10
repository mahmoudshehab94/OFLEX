import { useState, useEffect } from 'react';
import { Truck, Clock, Calendar, Download, LogOut } from 'lucide-react';
import { supabase, hasSupabaseConfig } from '../lib/supabase';
import { InstallationQuickTourModal } from './InstallationQuickTourModal';
import { useAuth } from '../contexts/AuthContext';

export function DriverSubmission() {
  const { user, logout } = useAuth();
  const [workDate, setWorkDate] = useState(new Date().toISOString().split('T')[0]);
  const [licenseLetters, setLicenseLetters] = useState('');
  const [licenseNumbers, setLicenseNumbers] = useState('');
  const [startHour, setStartHour] = useState('05');
  const [startMinute, setStartMinute] = useState('00');
  const [endHour, setEndHour] = useState('15');
  const [endMinute, setEndMinute] = useState('00');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [vehicleSuggestions, setVehicleSuggestions] = useState<string[]>([]);
  const [showVehicleSuggestions, setShowVehicleSuggestions] = useState(false);
  const [vehicleConflict, setVehicleConflict] = useState<any>(null);
  const [showConflictDetails, setShowConflictDetails] = useState(false);
  const [showInstallTour, setShowInstallTour] = useState(false);

  useEffect(() => {
    if (licenseLetters.length > 0 || licenseNumbers.length > 0) {
      loadVehicleSuggestions();
    } else {
      setVehicleSuggestions([]);
    }
  }, [licenseLetters, licenseNumbers]);

  const loadVehicleSuggestions = async () => {
    if (!supabase) return;

    try {
      const { data } = await supabase
        .from('work_entries')
        .select('vehicle')
        .ilike('vehicle', `${licenseLetters}${licenseNumbers}%`)
        .limit(5);

      if (data) {
        const unique = Array.from(new Set(data.map(d => d.vehicle))).filter(v => v);
        setVehicleSuggestions(unique);
      }
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const handleLicenseLettersChange = (value: string) => {
    const letters = value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    setLicenseLetters(letters);
    setShowVehicleSuggestions(true);

    if (letters.length === 2 && document.getElementById('licenseNumbers')) {
      (document.getElementById('licenseNumbers') as HTMLInputElement)?.focus();
    }
  };

  const handleLicenseNumbersChange = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, '').slice(0, 4);
    setLicenseNumbers(numbers);
    setShowVehicleSuggestions(true);
  };

  const handleVehicleSuggestionClick = (vehicle: string) => {
    const match = vehicle.match(/^([A-Z]+)(\d+)$/);
    if (match) {
      setLicenseLetters(match[1]);
      setLicenseNumbers(match[2]);
    }
    setShowVehicleSuggestions(false);
  };

  const handleLicenseNumbersKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && licenseNumbers === '' && document.getElementById('licenseLetters')) {
      (document.getElementById('licenseLetters') as HTMLInputElement)?.focus();
    }
  };

  const normalizeVehicle = (vehicle: string): string => {
    return vehicle.replace(/[\s-]/g, '').toUpperCase();
  };

  const checkVehicleConflict = async (vehicle: string, date: string, currentDriverId?: string) => {
    if (!vehicle || !supabase) return null;

    const normalizedVehicle = normalizeVehicle(vehicle);

    const { data: existingEntries } = await supabase
      .from('work_entries')
      .select('*, drivers(*)')
      .eq('date', date);

    if (existingEntries) {
      const conflict = existingEntries.find((entry: any) => {
        if (currentDriverId && entry.driver_id === currentDriverId) return false;
        if (!entry.vehicle) return false;
        const entryVehicle = normalizeVehicle(entry.vehicle);
        return entryVehicle === normalizedVehicle;
      });

      if (conflict && (conflict as any).drivers) {
        return {
          driver: (conflict as any).drivers,
          entry: conflict
        };
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!hasSupabaseConfig || !supabase) {
      setMessage({
        type: 'error',
        text: 'Konfigurationsfehler: Fehlende Supabase-Umgebungsvariablen'
      });
      setLoading(false);
      return;
    }

    if (!licenseLetters || !licenseNumbers) {
      setMessage({ type: 'error', text: 'Bitte gültiges Kennzeichen eingeben' });
      setLoading(false);
      return;
    }

    if (!endHour || !endMinute) {
      setMessage({ type: 'error', text: 'Bitte Endzeit eingeben' });
      setLoading(false);
      return;
    }

    const startTime = `${startHour}:${startMinute}`;
    const endTime = `${endHour}:${endMinute}`;

    const startMinutes = parseInt(startHour) * 60 + parseInt(startMinute);
    const endMinutes = parseInt(endHour) * 60 + parseInt(endMinute);

    if (endMinutes <= startMinutes) {
      setMessage({ type: 'error', text: 'Endzeit muss nach Startzeit liegen' });
      setLoading(false);
      return;
    }

    const vehicle = `${licenseLetters}${licenseNumbers}`;

    try {
      if (!user?.driver_id) {
        setMessage({
          type: 'error',
          text: 'Kein Fahrer-Konto verknüpft. Bitte wenden Sie sich an den Administrator.'
        });
        setLoading(false);
        return;
      }

      const driverId = user.driver_id;

      if (!vehicleConflict) {
        const conflict = await checkVehicleConflict(vehicle, workDate, driverId);
        if (conflict) {
          setVehicleConflict(conflict);
          setLoading(false);
          return;
        }
      }

      setVehicleConflict(null);
      setShowConflictDetails(false);

      const { error: workEntryError } = await supabase
        .from('work_entries')
        .insert({
          driver_id: driverId,
          vehicle: vehicle,
          date: workDate,
          start_time: startTime,
          end_time: endTime,
          break_minutes: 0,
          notes: notes.trim() || null
        });

      if (workEntryError) {
        console.error('Work entry insertion error:', workEntryError);

        if (workEntryError.code === '23505') {
          setMessage({
            type: 'error',
            text: 'Für dieses Datum existiert bereits ein Eintrag. Bitte wenden Sie sich an den Administrator.'
          });
        } else {
          setMessage({
            type: 'error',
            text: `Fehler beim Speichern: ${workEntryError.message}`
          });
        }
        setLoading(false);
        return;
      }

      setMessage({
        type: 'success',
        text: 'Arbeitszeit erfolgreich gespeichert!'
      });

      setLicenseLetters('');
      setLicenseNumbers('');
      setStartHour('05');
      setStartMinute('00');
      setEndHour('15');
      setEndMinute('00');
      setNotes('');
      setWorkDate(new Date().toISOString().split('T')[0]);
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
          <h2 className="text-red-400 font-bold text-xl mb-2">Konfigurationsfehler</h2>
          <p className="text-red-300">
            Fehlende Supabase-Umgebungsvariablen. Bitte konfigurieren Sie VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in Ihrer .env-Datei.
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-3 rounded-full shadow-lg">
              <Truck className="w-8 h-8 text-white" />
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Abmelden</span>
          </button>
        </div>

        <h1 className="text-2xl font-bold text-center text-white mb-2">
          Trans Oflex
        </h1>
        <p className="text-center text-gray-300 mb-8">
          Arbeitszeit erfassen
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="workDate" className="block text-sm font-medium text-gray-200 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Datum
            </label>
            <input
              type="date"
              id="workDate"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Kennzeichen
            </label>
            <div className="grid grid-cols-2 gap-3 relative">
              <div>
                <input
                  type="text"
                  id="licenseLetters"
                  value={licenseLetters}
                  onChange={(e) => handleLicenseLettersChange(e.target.value)}
                  onFocus={() => setShowVehicleSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowVehicleSuggestions(false), 200)}
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
                  onFocus={() => setShowVehicleSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowVehicleSuggestions(false), 200)}
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
            {showVehicleSuggestions && vehicleSuggestions.length > 0 && (
              <div className="mt-2 bg-gray-700 border border-gray-600 rounded-lg overflow-hidden">
                {vehicleSuggestions.map((vehicle, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleVehicleSuggestionClick(vehicle)}
                    className="w-full px-4 py-2 text-left text-white hover:bg-gray-600 transition"
                  >
                    {vehicle}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                von
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
                bis
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

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-200 mb-2">
              Notiz (optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition placeholder-gray-400 resize-none"
              placeholder="Optionale Notizen..."
              rows={3}
            />
          </div>

          {vehicleConflict && (
            <div className="p-4 bg-amber-900/50 border border-amber-600 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-amber-800 rounded-full flex items-center justify-center">
                    <span className="text-lg">⚠️</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-100 mb-1">Warnung: Fahrzeugkonflikt</h4>
                  <p className="text-sm text-amber-200 mb-2">
                    Dieses Fahrzeug wurde heute bereits von einem anderen Fahrer eingetragen.
                  </p>
                  {showConflictDetails && (
                    <div className="mt-3 p-3 bg-gray-800 rounded border border-amber-700">
                      <p className="text-sm text-gray-200 mb-1">
                        <strong>Fahrer:</strong> {vehicleConflict.driver.driver_name} ({vehicleConflict.driver.driver_code})
                      </p>
                      <p className="text-sm text-gray-200 mb-1">
                        <strong>Fahrzeug:</strong> {vehicleConflict.entry.vehicle}
                      </p>
                      <p className="text-sm text-gray-200">
                        <strong>Arbeitszeit:</strong> {vehicleConflict.entry.start_time} - {vehicleConflict.entry.end_time}
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowConflictDetails(!showConflictDetails)}
                    className="mt-2 text-sm text-amber-300 hover:text-amber-100 underline"
                  >
                    {showConflictDetails ? 'Details ausblenden' : 'Details anzeigen'}
                  </button>
                </div>
              </div>
            </div>
          )}

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
            {loading ? 'Wird gespeichert...' : vehicleConflict ? 'Trotzdem speichern' : 'Arbeitszeit speichern'}
          </button>
        </form>

        <div className="mt-6 border-t border-gray-700 pt-6">
          <button
            type="button"
            onClick={() => setShowInstallTour(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-gray-500 text-gray-200 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="font-medium">App installieren</span>
          </button>
        </div>

        <div className="mt-6 text-center text-xs text-gray-500">
          <a
            href="/admin"
            className="hover:text-gray-300 transition cursor-pointer"
          >
            <p>Created by Mahmoud Shehab</p>
            <p className="mt-0.5">v2.1.0</p>
          </a>
        </div>
      </div>

      <InstallationQuickTourModal
        isOpen={showInstallTour}
        onClose={() => setShowInstallTour(false)}
      />
    </div>
  );
}
