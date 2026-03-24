import { useState, useEffect } from 'react';
import { Truck, Clock, Calendar, LogOut, User, ScanLine } from 'lucide-react';
import { supabase, hasSupabaseConfig } from '../lib/supabase';
import { DriverProfileModern } from './DriverProfileModern';
import { ScanPage } from './ScanPage';
import { useAuth } from '../contexts/AuthContext';

const getAvatarUrl = (avatarPath: string | null | undefined): string | null => {
  if (!avatarPath || !supabase) return null;

  // If already a full URL, return as is
  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
    return avatarPath;
  }

  // Otherwise, generate the public URL from the path
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(avatarPath);

  return publicUrl;
};

export function DriverSubmission() {
  const { user, logout } = useAuth();

  if (!user || user.role !== 'driver') {
    window.history.pushState({}, '', '/');
    window.location.reload();
    return null;
  }

  const avatarUrl = getAvatarUrl(user?.avatar_url);

  const [showProfile, setShowProfile] = useState(false);
  const [showScan, setShowScan] = useState(false);
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

      // Work entry saved successfully - this will automatically stop daily reminders
      // The Edge Function checks for today's work entries before sending reminders

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

  if (showProfile) {
    return <DriverProfileModern onBack={() => setShowProfile(false)} />;
  }

  if (showScan) {
    return <ScanPage onBack={() => setShowScan(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-3 sm:p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
      <div className="relative z-10 backdrop-blur-xl bg-gradient-to-br from-slate-800/90 via-slate-900/90 to-slate-800/90 rounded-2xl shadow-2xl w-full max-w-md p-4 sm:p-6 md:p-8 border border-white/10">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative bg-gradient-to-br from-blue-500/20 to-cyan-500/20 p-2 sm:p-3 rounded-2xl shadow-lg border border-blue-500/30">
                <Truck className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProfile(true)}
              className="group p-1 hover:opacity-80 transition-all rounded-full flex-shrink-0"
              title="Profil"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-white/20 group-hover:border-blue-500/50 transition-all ring-2 ring-blue-500/20 group-hover:scale-105"
                  onError={(e) => {
                    console.error('Avatar load error:', avatarUrl);
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.innerHTML = `<div class="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-800/50 flex items-center justify-center border-2 border-white/20"><svg class="w-5 h-5 sm:w-6 sm:h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg></div>`;
                    }
                  }}
                />
              ) : (
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-800/50 flex items-center justify-center border-2 border-white/20 group-hover:border-blue-500/50 transition-all ring-2 ring-blue-500/20 group-hover:scale-105">
                  <User className="w-5 h-5 sm:w-6 sm:h-6 text-slate-300" />
                </div>
              )}
            </button>
            <button
              onClick={logout}
              className="group relative flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-r from-red-500/10 to-red-600/10 hover:from-red-500/20 hover:to-red-600/20 text-red-400 hover:text-red-300 rounded-xl transition-all border border-red-500/30 hover:border-red-500/50 hover:scale-105 active:scale-95 shadow-lg shadow-red-500/10 hover:shadow-red-500/20 text-sm sm:text-base overflow-hidden"
              title="Abmelden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5 relative z-10 group-hover:rotate-12 transition-transform" />
              <span className="hidden sm:inline font-semibold relative z-10">Abmelden</span>
            </button>
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-center bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent mb-1 sm:mb-2">
          Trans Oflex
        </h1>
        <p className="text-center text-slate-400 mb-6 sm:mb-8 text-sm sm:text-base font-medium">
          Arbeitszeit erfassen
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div>
            <label htmlFor="workDate" className="block text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              Datum
            </label>
            <input
              type="date"
              id="workDate"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="w-full px-3 py-2.5 sm:px-4 sm:py-3 bg-slate-900/50 border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all backdrop-blur-xl text-sm sm:text-base hover:bg-slate-900/70"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
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
                  className="w-full px-2 py-2.5 sm:px-4 sm:py-3 bg-slate-900/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all backdrop-blur-xl text-center font-bold text-base sm:text-lg uppercase text-white placeholder-slate-500 hover:bg-slate-900/70"
                  placeholder="MI"
                  maxLength={2}
                  required
                  autoComplete="off"
                />
                <p className="text-xs text-slate-400 mt-1.5 text-center font-medium">Buchstaben</p>
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
                  className="w-full px-2 py-2.5 sm:px-4 sm:py-3 bg-slate-900/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all backdrop-blur-xl text-center font-bold text-base sm:text-lg text-white placeholder-slate-500 hover:bg-slate-900/70"
                  placeholder="299"
                  maxLength={4}
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                />
                <p className="text-xs text-slate-400 mt-1.5 text-center font-medium">Nummer</p>
              </div>
            </div>
            {showVehicleSuggestions && vehicleSuggestions.length > 0 && (
              <div className="mt-2 bg-slate-900/70 border border-white/10 rounded-xl overflow-hidden backdrop-blur-xl shadow-lg">
                {vehicleSuggestions.map((vehicle, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleVehicleSuggestionClick(vehicle)}
                    className="w-full px-4 py-2.5 text-left text-white hover:bg-blue-500/20 transition-all font-medium border-b border-white/5 last:border-0"
                  >
                    {vehicle}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                von
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <select
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="w-full px-2 py-2.5 sm:px-4 sm:py-3 bg-slate-900/50 border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all backdrop-blur-xl text-center font-mono text-base sm:text-lg hover:bg-slate-900/70"
                    required
                  >
                    {hours.map(h => (
                      <option key={h} value={h} className="bg-slate-900">{h}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1.5 text-center font-medium">Stunde</p>
                </div>
                <div>
                  <select
                    value={startMinute}
                    onChange={(e) => setStartMinute(e.target.value)}
                    className="w-full px-2 py-2.5 sm:px-4 sm:py-3 bg-slate-900/50 border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all backdrop-blur-xl text-center font-mono text-base sm:text-lg hover:bg-slate-900/70"
                    required
                  >
                    {minutes.map(m => (
                      <option key={m} value={m} className="bg-slate-900">{m}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1.5 text-center font-medium">Minute</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                bis
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <select
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    className="w-full px-2 py-2.5 sm:px-4 sm:py-3 bg-slate-900/50 border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all backdrop-blur-xl text-center font-mono text-base sm:text-lg hover:bg-slate-900/70"
                    required
                  >
                    <option value="" className="bg-slate-900">--</option>
                    {hours.map(h => (
                      <option key={h} value={h} className="bg-slate-900">{h}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1.5 text-center font-medium">Stunde</p>
                </div>
                <div>
                  <select
                    value={endMinute}
                    onChange={(e) => setEndMinute(e.target.value)}
                    className="w-full px-2 py-2.5 sm:px-4 sm:py-3 bg-slate-900/50 border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all backdrop-blur-xl text-center font-mono text-base sm:text-lg hover:bg-slate-900/70"
                    required
                  >
                    <option value="" className="bg-slate-900">--</option>
                    {minutes.map(m => (
                      <option key={m} value={m} className="bg-slate-900">{m}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1.5 text-center font-medium">Minute</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-semibold text-slate-300 mb-2">
              Notiz (optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2.5 sm:px-4 sm:py-3 bg-slate-900/50 border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all backdrop-blur-xl placeholder-slate-500 resize-none text-sm sm:text-base hover:bg-slate-900/70"
              placeholder="Optionale Notizen..."
              rows={3}
            />
          </div>

          {vehicleConflict && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl backdrop-blur-xl shadow-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center border border-amber-500/30">
                    <span className="text-lg">⚠️</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-300 mb-1">Warnung: Fahrzeugkonflikt</h4>
                  <p className="text-sm text-amber-200/80 mb-2">
                    Dieses Fahrzeug wurde heute bereits von einem anderen Fahrer eingetragen.
                  </p>
                  {showConflictDetails && (
                    <div className="mt-3 p-3 bg-slate-900/50 rounded-xl border border-amber-500/20">
                      <p className="text-sm text-slate-200 mb-1">
                        <strong>Fahrer:</strong> {vehicleConflict.driver.driver_name}
                      </p>
                      <p className="text-sm text-slate-200 mb-1">
                        <strong>Fahrzeug:</strong> {vehicleConflict.entry.vehicle}
                      </p>
                      <p className="text-sm text-slate-200">
                        <strong>Arbeitszeit:</strong> {vehicleConflict.entry.start_time} - {vehicleConflict.entry.end_time}
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowConflictDetails(!showConflictDetails)}
                    className="mt-2 text-sm text-amber-300 hover:text-amber-200 underline font-medium"
                  >
                    {showConflictDetails ? 'Details ausblenden' : 'Details anzeigen'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {message && (
            <div
              className={`p-3 sm:p-4 rounded-xl backdrop-blur-xl text-sm sm:text-base ${
                message.type === 'success'
                  ? 'bg-green-500/10 text-green-300 border border-green-500/30 shadow-lg shadow-green-500/10'
                  : 'bg-red-500/10 text-red-300 border border-red-500/30 shadow-lg shadow-red-500/10'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl font-bold hover:from-blue-600 hover:to-cyan-600 focus:ring-4 focus:ring-blue-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base"
          >
            {loading ? 'Wird gespeichert...' : vehicleConflict ? 'Trotzdem speichern' : 'Arbeitszeit speichern'}
          </button>
        </form>

        <div className="mt-4 sm:mt-6 border-t border-white/10 pt-4 sm:pt-6">
          <button
            type="button"
            onClick={() => setShowScan(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-300 hover:text-cyan-200 rounded-xl transition-all text-sm sm:text-base font-semibold hover:scale-[1.02] active:scale-[0.98]"
          >
            <ScanLine className="w-5 h-5" />
            <span className="font-medium">Scan</span>
          </button>
        </div>

        <div className="mt-4 sm:mt-6 text-center text-xs text-gray-500">
          <p>Created by Mahmoud Shehab</p>
          <p className="mt-0.5">v2.2.0</p>
        </div>
      </div>
    </div>
  );
}
