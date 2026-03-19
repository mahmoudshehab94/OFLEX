import { useState, useEffect } from 'react';
import { User, Lock, Camera, BarChart3, Calendar, Clock, Truck, ArrowLeft, LogOut, Eye, EyeOff, TrendingUp, Bell, CreditCard, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, hashPassword } from '../lib/supabase';
import { NotificationSettings } from './NotificationSettings';
import { MonthSelector } from './MonthSelector';
import { calculateMonthStatistics, MonthStats } from '../lib/statisticsUtils';

interface DriverStats extends MonthStats {
  mostUsedVehicle: string | null;
}

interface DriverInfo {
  driver_name: string;
  id_barcode_image_url: string | null;
}

interface DriverProfileProps {
  onBack: () => void;
}

const getAvatarUrl = (avatarPath: string | null): string | null => {
  if (!avatarPath || !supabase) return null;

  // If it's already a full URL, return it
  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
    return avatarPath;
  }

  // Otherwise, generate the public URL from the path
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(avatarPath);

  return publicUrl;
};

const updateUserProfileAPI = async (userId: string, updates: {
  username?: string;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string;
  password_hash?: string;
}) => {
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-profile`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, ...updates }),
    });

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('Error calling update-profile API:', error);
    return { success: false, error: error.message };
  }
};

export function DriverProfile({ onBack }: DriverProfileProps) {
  const { user, logout, updateUserAvatar } = useAuth();
  const [activeTab, setActiveTab] = useState<'stats' | 'settings' | 'notifications'>('stats');
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

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
  const [uploadingIdBarcode, setUploadingIdBarcode] = useState(false);
  const [idBarcodePreview, setIdBarcodePreview] = useState<string | null>(null);

  useEffect(() => {
    loadDriverData();
  }, [selectedYear, selectedMonth]);

  const loadDriverData = async () => {
    if (!user?.driver_id) return;
    if (!supabase) return;

    try {
      const { data: driver } = await supabase
        .from('drivers')
        .select('driver_name, id_barcode_image_url')
        .eq('id', user.driver_id)
        .single();

      if (driver) {
        setDriverInfo(driver);
        setNewDisplayName(driver.driver_name);
        setIdBarcodePreview(driver.id_barcode_image_url);
      }

      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const endDate = new Date(selectedYear, selectedMonth, 0);
      const endDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

      const { data: entries } = await supabase
        .from('work_entries')
        .select('*')
        .eq('driver_id', user.driver_id)
        .gte('date', startDate)
        .lte('date', endDateStr);

      const baseStats = calculateMonthStatistics(entries || [], selectedYear, selectedMonth);

      const vehicleCounts: Record<string, number> = {};
      (entries || []).forEach(entry => {
        if (entry.vehicle) {
          vehicleCounts[entry.vehicle] = (vehicleCounts[entry.vehicle] || 0) + 1;
        }
      });

      const mostUsedVehicle = Object.keys(vehicleCounts).length > 0
        ? Object.entries(vehicleCounts).sort((a, b) => b[1] - a[1])[0][0]
        : null;

      setStats({
        ...baseStats,
        mostUsedVehicle
      });
    } catch (error) {
      console.error('Error loading driver data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
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

      // Hash the current password to compare with stored hash
      const currentPasswordHash = await hashPassword(currentPassword);
      if (!account || account.password_hash !== currentPasswordHash) {
        setMessage({ type: 'error', text: 'Aktuelles Passwort ist falsch' });
        setChangingPassword(false);
        return;
      }

      // Hash the new password and update using Edge Function (bypasses RLS)
      const newPasswordHash = await hashPassword(newPassword);
      const result = await updateUserProfileAPI(user?.id || '', { password_hash: newPasswordHash });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update password');
      }

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

      // Update account using Edge Function (bypasses RLS)
      const result = await updateUserProfileAPI(user?.id || '', { username: newDisplayName.trim() });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update username');
      }

      setMessage({ type: 'success', text: 'Name erfolgreich aktualisiert' });

      const sessionData = localStorage.getItem('userSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        session.user.username = newDisplayName.trim();
        localStorage.setItem('userSession', JSON.stringify(session));
      }

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
      if (!supabase || !user) {
        setMessage({ type: 'error', text: 'Datenbankfehler' });
        setUploadingPhoto(false);
        return;
      }

      if (user.avatar_url) {
        const oldPath = user.avatar_url.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('avatars')
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL for the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      // Update profile using Edge Function (bypasses RLS)
      const result = await updateUserProfileAPI(user.id, { avatar_url: publicUrl });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update avatar');
      }

      if (updateUserAvatar) {
        updateUserAvatar(publicUrl);
      }

      setMessage({ type: 'success', text: 'Profilbild erfolgreich hochgeladen' });
    } catch (error) {
      console.error('Error uploading photo:', error);
      setMessage({ type: 'error', text: 'Fehler beim Hochladen des Profilbilds' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleIdBarcodeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setUploadingIdBarcode(true);
    setMessage(null);

    try {
      if (!supabase || !user || !user.driver_id) {
        setMessage({ type: 'error', text: 'Datenbankfehler' });
        setUploadingIdBarcode(false);
        return;
      }

      if (driverInfo?.id_barcode_image_url) {
        const oldPath = driverInfo.id_barcode_image_url.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('avatars')
            .remove([`${user.id}/id_barcode_${oldPath}`]);
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `id_barcode_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('drivers')
        .update({ id_barcode_image_url: publicUrl })
        .eq('id', user.driver_id);

      if (updateError) throw updateError;

      setIdBarcodePreview(publicUrl);
      setMessage({ type: 'success', text: 'Ausweiscode erfolgreich hochgeladen' });
      loadDriverData();
    } catch (error) {
      console.error('Error uploading ID barcode:', error);
      setMessage({ type: 'error', text: 'Fehler beim Hochladen des Ausweiscodes' });
    } finally {
      setUploadingIdBarcode(false);
    }
  };

  const handleIdBarcodeRemove = async () => {
    if (!user?.driver_id || !driverInfo?.id_barcode_image_url) return;

    setMessage(null);

    try {
      if (!supabase) {
        setMessage({ type: 'error', text: 'Datenbankfehler' });
        return;
      }

      const oldPath = driverInfo.id_barcode_image_url.split('/').pop();
      if (oldPath) {
        await supabase.storage
          .from('avatars')
          .remove([`${user.id}/${oldPath}`]);
      }

      const { error: updateError } = await supabase
        .from('drivers')
        .update({ id_barcode_image_url: null })
        .eq('id', user.driver_id);

      if (updateError) throw updateError;

      setIdBarcodePreview(null);
      setMessage({ type: 'success', text: 'Ausweiscode erfolgreich entfernt' });
      loadDriverData();
    } catch (error) {
      console.error('Error removing ID barcode:', error);
      setMessage({ type: 'error', text: 'Fehler beim Entfernen des Ausweiscodes' });
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
                {getAvatarUrl(user?.avatar_url || null) ? (
                  <img
                    src={getAvatarUrl(user?.avatar_url || null)!}
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
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'notifications'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/30'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Bell className="w-4 h-4 inline mr-2" />
              Benachrichtigungen
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
                <MonthSelector
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  onMonthChange={handleMonthChange}
                  variant="driver"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-white/20 p-3 rounded-lg">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-blue-100 text-sm font-medium">Arbeitstage</p>
                        <p className="text-3xl font-bold">{stats.arbeitstage}</p>
                      </div>
                    </div>
                    <p className="text-blue-100 text-sm">Tage mit Einträgen</p>
                  </div>

                  <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-white/20 p-3 rounded-lg">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-green-100 text-sm font-medium">Gesamtstunden</p>
                        <p className="text-3xl font-bold">{stats.gesamtstunden}h</p>
                      </div>
                    </div>
                    <p className="text-green-100 text-sm">Im gewählten Monat</p>
                  </div>

                  <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-white/20 p-3 rounded-lg">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-orange-100 text-sm font-medium">Durchschnitt</p>
                        <p className="text-3xl font-bold">{stats.durchschnitt}h</p>
                      </div>
                    </div>
                    <p className="text-orange-100 text-sm">Stunden pro Tag</p>
                  </div>

                  <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-white/20 p-3 rounded-lg">
                        <BarChart3 className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-cyan-100 text-sm font-medium">Einträge</p>
                        <p className="text-3xl font-bold">{stats.entries}</p>
                      </div>
                    </div>
                    <p className="text-cyan-100 text-sm">Erfasste Arbeitstage</p>
                  </div>

                  <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-white/20 p-3 rounded-lg">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-red-100 text-sm font-medium">Fehlende Tage</p>
                        <p className="text-3xl font-bold">{stats.fehlendeTage}</p>
                      </div>
                    </div>
                    <p className="text-red-100 text-sm truncate">
                      {stats.fehlendeTageList.length > 0 ? stats.fehlendeTageList.join(', ') : '-'}
                    </p>
                  </div>
                </div>

                {stats.mostUsedVehicle && (
                  <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-4">
                      <div className="bg-white/20 p-4 rounded-lg">
                        <Truck className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-yellow-100 text-sm font-medium mb-1">Meist genutztes Fahrzeug</p>
                        <p className="text-3xl font-bold">{stats.mostUsedVehicle}</p>
                      </div>
                    </div>
                  </div>
                )}

                {stats.entries === 0 && (
                  <div className="bg-gray-700/50 border border-gray-600 rounded-xl p-8 text-center">
                    <Calendar className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400 text-lg">Keine Einträge für diesen Monat</p>
                    <p className="text-gray-500 text-sm mt-2">Fügen Sie Ihre ersten Arbeitsstunden hinzu</p>
                  </div>
                )}
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
                    {getAvatarUrl(user?.avatar_url || null) ? (
                      <img
                        src={getAvatarUrl(user?.avatar_url || null)!}
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
                            file:cursor-pointer file:transition
                            disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </label>
                      <p className="mt-2 text-xs text-gray-400">
                        {uploadingPhoto ? 'Wird hochgeladen...' : 'PNG, JPG bis zu 5MB'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Ausweiscode
                  </h3>
                  <div className="space-y-4">
                    {idBarcodePreview ? (
                      <div className="space-y-4">
                        <div className="relative inline-block">
                          <img
                            src={idBarcodePreview}
                            alt="ID Barcode"
                            className="max-w-full h-auto rounded-lg border-2 border-gray-600 max-h-48 object-contain"
                          />
                        </div>
                        <div className="flex gap-2">
                          <label className="flex-1">
                            <span className="sr-only">Neues Bild auswählen</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleIdBarcodeUpload}
                              disabled={uploadingIdBarcode}
                              className="hidden"
                              id="id-barcode-replace"
                            />
                            <label
                              htmlFor="id-barcode-replace"
                              className={`block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition cursor-pointer ${
                                uploadingIdBarcode ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              {uploadingIdBarcode ? 'Wird hochgeladen...' : 'Bild ändern'}
                            </label>
                          </label>
                          <button
                            onClick={handleIdBarcodeRemove}
                            disabled={uploadingIdBarcode}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            <X className="w-4 h-4" />
                            Entfernen
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block">
                          <span className="sr-only">Ausweiscode hochladen</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleIdBarcodeUpload}
                            disabled={uploadingIdBarcode}
                            className="block w-full text-sm text-gray-300
                              file:mr-4 file:py-2 file:px-4
                              file:rounded-lg file:border-0
                              file:text-sm file:font-semibold
                              file:bg-blue-600 file:text-white
                              hover:file:bg-blue-700
                              file:cursor-pointer file:transition
                              disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </label>
                        <p className="mt-2 text-xs text-gray-400">
                          {uploadingIdBarcode ? 'Wird hochgeladen...' : 'PNG, JPG bis zu 5MB'}
                        </p>
                      </div>
                    )}
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

            {activeTab === 'notifications' && user && (
              <NotificationSettings
                userAccountId={user.id}
                role="driver"
                driverId={user.driver_id}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
