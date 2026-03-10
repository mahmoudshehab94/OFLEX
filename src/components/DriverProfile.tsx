import { useState, useEffect } from 'react';
import { User, Lock, Camera, BarChart3, Calendar, Clock, Truck, ArrowLeft, LogOut, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface DriverStats {
  totalEntries: number;
  totalHours: number;
  currentMonthEntries: number;
  currentMonthHours: number;
  mostUsedVehicle: string | null;
}

interface DriverInfo {
  driver_name: string;
  driver_code: string;
  license_number: string | null;
  phone: string | null;
  email: string | null;
}

interface DriverProfileProps {
  onBack: () => void;
}

export function DriverProfile({ onBack }: DriverProfileProps) {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'stats' | 'info' | 'settings'>('stats');
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [newDisplayName, setNewDisplayName] = useState('');
  const [updatingName, setUpdatingName] = useState(false);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    loadDriverData();
  }, []);

  const loadDriverData = async () => {
    if (!user?.driver_id) return;
    if (!supabase) return;

    try {
      const { data: driver } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', user.driver_id)
        .single();

      if (driver) {
        setDriverInfo(driver);
        setNewDisplayName(driver.driver_name);
      }

      const { data: entries } = await supabase
        .from('work_entries')
        .select('*')
        .eq('driver_id', user.driver_id);

      if (entries) {
        const totalHours = entries.reduce((sum, entry) => {
          const start = entry.start_time.split(':');
          const end = entry.end_time.split(':');
          const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
          const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);
          const hours = (endMinutes - startMinutes) / 60;
          return sum + hours;
        }, 0);

        const currentMonth = new Date().toISOString().slice(0, 7);
        const currentMonthEntries = entries.filter(e => e.date.startsWith(currentMonth));
        const currentMonthHours = currentMonthEntries.reduce((sum, entry) => {
          const start = entry.start_time.split(':');
          const end = entry.end_time.split(':');
          const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
          const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);
          const hours = (endMinutes - startMinutes) / 60;
          return sum + hours;
        }, 0);

        const vehicleCounts: Record<string, number> = {};
        entries.forEach(entry => {
          if (entry.vehicle) {
            vehicleCounts[entry.vehicle] = (vehicleCounts[entry.vehicle] || 0) + 1;
          }
        });

        const mostUsedVehicle = Object.keys(vehicleCounts).length > 0
          ? Object.entries(vehicleCounts).sort((a, b) => b[1] - a[1])[0][0]
          : null;

        setStats({
          totalEntries: entries.length,
          totalHours: Math.round(totalHours * 10) / 10,
          currentMonthEntries: currentMonthEntries.length,
          currentMonthHours: Math.round(currentMonthHours * 10) / 10,
          mostUsedVehicle
        });
      }
    } catch (error) {
      console.error('Error loading driver data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Neue Passwörter stimmen nicht überein' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Passwort muss mindestens 6 Zeichen lang sein' });
      return;
    }

    setChangingPassword(true);

    try {
      if (!supabase) {
        setMessage({ type: 'error', text: 'Datenbankfehler' });
        setChangingPassword(false);
        return;
      }

      const { data: account } = await supabase
        .from('user_accounts')
        .select('password_hash')
        .eq('id', user?.id)
        .single();

      if (!account || account.password_hash !== currentPassword) {
        setMessage({ type: 'error', text: 'Aktuelles Passwort ist falsch' });
        setChangingPassword(false);
        return;
      }

      const { error } = await supabase
        .from('user_accounts')
        .update({ password_hash: newPassword })
        .eq('id', user?.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Passwort erfolgreich geändert' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      setMessage({ type: 'error', text: 'Fehler beim Ändern des Passworts' });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleNameUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!newDisplayName.trim()) {
      setMessage({ type: 'error', text: 'Name darf nicht leer sein' });
      return;
    }

    setUpdatingName(true);

    try {
      if (!supabase) {
        setMessage({ type: 'error', text: 'Datenbankfehler' });
        setUpdatingName(false);
        return;
      }

      const { error: driverError } = await supabase
        .from('drivers')
        .update({ driver_name: newDisplayName.trim() })
        .eq('id', user?.driver_id);

      if (driverError) throw driverError;

      const { error: accountError } = await supabase
        .from('user_accounts')
        .update({ username: newDisplayName.trim() })
        .eq('id', user?.id);

      if (accountError) throw accountError;

      setMessage({ type: 'success', text: 'Name erfolgreich aktualisiert' });
      loadDriverData();
    } catch (error) {
      console.error('Error updating name:', error);
      setMessage({ type: 'error', text: 'Fehler beim Aktualisieren des Namens' });
    } finally {
      setUpdatingName(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Bitte wählen Sie eine Bilddatei' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Bild darf maximal 5 MB groß sein' });
      return;
    }

    setUploadingPhoto(true);
    setMessage(null);

    try {
      if (!supabase) {
        setMessage({ type: 'error', text: 'Datenbankfehler' });
        setUploadingPhoto(false);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;

        if (!supabase) return;

        const { error } = await supabase
          .from('user_accounts')
          .update({ avatar_url: base64String })
          .eq('id', user?.id);

        if (error) throw error;

        setMessage({ type: 'success', text: 'Profilbild erfolgreich hochgeladen' });
        window.location.reload();
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading photo:', error);
      setMessage({ type: 'error', text: 'Fehler beim Hochladen des Profilbilds' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 flex items-center justify-center">
        <div className="text-white text-xl">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Zurück</span>
              </button>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Abmelden</span>
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="Profile"
                    className="w-20 h-20 rounded-full border-4 border-white/20 object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-white/10 border-4 border-white/20 flex items-center justify-center">
                    <User className="w-10 h-10 text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white">{user?.username}</h1>
                <p className="text-blue-100">{driverInfo?.driver_code}</p>
              </div>
            </div>
          </div>

          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'stats'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/30'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              Statistiken
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'info'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/30'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <User className="w-4 h-4 inline mr-2" />
              Persönliche Daten
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/30'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Lock className="w-4 h-4 inline mr-2" />
              Einstellungen
            </button>
          </div>

          <div className="p-6">
            {message && (
              <div
                className={`mb-6 p-4 rounded-lg ${
                  message.type === 'success'
                    ? 'bg-green-900/50 text-green-200 border border-green-700'
                    : 'bg-red-900/50 text-red-200 border border-red-700'
                }`}
              >
                {message.text}
              </div>
            )}

            {activeTab === 'stats' && stats && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                    <div className="flex items-center gap-3 mb-2">
                      <Calendar className="w-5 h-5 text-blue-400" />
                      <h3 className="text-gray-300 font-medium">Gesamt Einträge</h3>
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.totalEntries}</p>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                    <div className="flex items-center gap-3 mb-2">
                      <Clock className="w-5 h-5 text-green-400" />
                      <h3 className="text-gray-300 font-medium">Gesamt Stunden</h3>
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.totalHours}h</p>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                    <div className="flex items-center gap-3 mb-2">
                      <Calendar className="w-5 h-5 text-purple-400" />
                      <h3 className="text-gray-300 font-medium">Dieser Monat</h3>
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.currentMonthEntries}</p>
                    <p className="text-sm text-gray-400 mt-1">Einträge</p>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                    <div className="flex items-center gap-3 mb-2">
                      <Clock className="w-5 h-5 text-orange-400" />
                      <h3 className="text-gray-300 font-medium">Stunden (Monat)</h3>
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.currentMonthHours}h</p>
                  </div>
                </div>

                {stats.mostUsedVehicle && (
                  <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                    <div className="flex items-center gap-3 mb-2">
                      <Truck className="w-5 h-5 text-yellow-400" />
                      <h3 className="text-gray-300 font-medium">Meist genutztes Fahrzeug</h3>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.mostUsedVehicle}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'info' && driverInfo && (
              <div className="space-y-4">
                <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                      <p className="text-lg text-white">{driverInfo.driver_name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Fahrer-Code</label>
                      <p className="text-lg text-white">{driverInfo.driver_code}</p>
                    </div>
                    {driverInfo.license_number && (
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Führerscheinnummer</label>
                        <p className="text-lg text-white">{driverInfo.license_number}</p>
                      </div>
                    )}
                    {driverInfo.phone && (
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Telefon</label>
                        <p className="text-lg text-white">{driverInfo.phone}</p>
                      </div>
                    )}
                    {driverInfo.email && (
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">E-Mail</label>
                        <p className="text-lg text-white">{driverInfo.email}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Camera className="w-5 h-5" />
                    Profilbild
                  </h3>
                  <div className="flex items-center gap-4">
                    {user?.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt="Profile"
                        className="w-20 h-20 rounded-full border-2 border-gray-600 object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gray-600 border-2 border-gray-500 flex items-center justify-center">
                        <User className="w-10 h-10 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <label className="block">
                        <span className="sr-only">Profilbild auswählen</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          disabled={uploadingPhoto}
                          className="block w-full text-sm text-gray-300
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-lg file:border-0
                            file:text-sm file:font-semibold
                            file:bg-blue-600 file:text-white
                            hover:file:bg-blue-700
                            file:cursor-pointer file:transition"
                        />
                      </label>
                      <p className="mt-2 text-xs text-gray-400">PNG, JPG bis zu 5MB</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleNameUpdate} className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Anzeigename ändern
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-2">
                        Neuer Name
                      </label>
                      <input
                        type="text"
                        id="displayName"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-600 border border-gray-500 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={updatingName}
                      className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updatingName ? 'Wird aktualisiert...' : 'Name aktualisieren'}
                    </button>
                  </div>
                </form>

                <form onSubmit={handlePasswordChange} className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Passwort ändern
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300 mb-2">
                        Aktuelles Passwort
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          id="currentPassword"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-600 border border-gray-500 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition pr-12"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                        >
                          {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-2">
                        Neues Passwort
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          id="newPassword"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-600 border border-gray-500 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition pr-12"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                        >
                          {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                        Neues Passwort bestätigen
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          id="confirmPassword"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-600 border border-gray-500 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition pr-12"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                        >
                          {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={changingPassword}
                      className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {changingPassword ? 'Wird geändert...' : 'Passwort ändern'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
