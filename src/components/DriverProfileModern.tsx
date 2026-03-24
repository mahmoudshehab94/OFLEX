import { useState, useEffect } from 'react';
import { User, Lock, Camera, BarChart3, Calendar, Clock, Truck, ArrowLeft, LogOut, Eye, EyeOff, TrendingUp, Bell, CreditCard, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, hashPassword } from '../lib/supabase';
import { NotificationSettings } from './NotificationSettings';
import { MonthSelector } from './MonthSelector';
import { calculateMonthStatistics, MonthStats } from '../lib/statisticsUtils';
import { BarcodeModal } from './BarcodeModal';

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
  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
    return avatarPath;
  }
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

export function DriverProfileModern({ onBack }: DriverProfileProps) {
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
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);

  useEffect(() => {
    loadDriverData();
  }, [selectedYear, selectedMonth]);

  const loadDriverData = async () => {
    if (!user?.driver_id || !supabase) return;

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

      const currentPasswordHash = await hashPassword(currentPassword);
      if (!account || account.password_hash !== currentPasswordHash) {
        setMessage({ type: 'error', text: 'Aktuelles Passwort ist falsch' });
        setChangingPassword(false);
        return;
      }

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

      const result = await updateUserProfileAPI(user?.id || '', { full_name: newDisplayName.trim() });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update full name');
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

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

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

      if (uploadError) throw uploadError;

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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Modern Header with Glassmorphism */}
      <div className="relative backdrop-blur-xl bg-gradient-to-br from-slate-800/90 via-slate-900/90 to-slate-800/90 border-b border-white/10 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Top Actions */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={onBack}
              className="group flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all duration-300 border border-white/10 hover:border-white/20 hover:shadow-lg hover:scale-105"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium">Zurück</span>
            </button>
            <button
              onClick={logout}
              className="group flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all duration-300 border border-red-500/20 hover:border-red-500/30 hover:shadow-lg hover:shadow-red-500/20 hover:scale-105"
            >
              <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              <span className="font-medium">Abmelden</span>
            </button>
          </div>

          {/* Profile Section */}
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
              {getAvatarUrl(user?.avatar_url || null) ? (
                <img
                  src={getAvatarUrl(user?.avatar_url || null)!}
                  alt="Profile"
                  className="relative w-28 h-28 rounded-full border-4 border-white/20 object-cover shadow-2xl ring-4 ring-blue-500/20 group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-4 border-white/20 flex items-center justify-center shadow-2xl ring-4 ring-blue-500/20 group-hover:scale-105 transition-transform duration-300">
                  <User className="w-14 h-14 text-blue-400" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full border-4 border-slate-900 shadow-lg"></div>
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent mb-2 tracking-tight">
                {user?.username}
              </h1>
              <p className="text-slate-400 text-sm font-medium">Fahrer-Dashboard</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Tab Navigation */}
      <div className="relative backdrop-blur-xl bg-slate-900/50 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2 pt-4">
            <button
              onClick={() => setActiveTab('stats')}
              className={`group relative px-6 py-3 font-semibold transition-all duration-300 rounded-t-xl ${
                activeTab === 'stats'
                  ? 'text-white bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-t-2 border-x-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className={`w-5 h-5 transition-transform duration-300 ${activeTab === 'stats' ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span>Statistiken</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`group relative px-6 py-3 font-semibold transition-all duration-300 rounded-t-xl ${
                activeTab === 'settings'
                  ? 'text-white bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-t-2 border-x-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2">
                <Lock className={`w-5 h-5 transition-transform duration-300 ${activeTab === 'settings' ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span>Einstellungen</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`group relative px-6 py-3 font-semibold transition-all duration-300 rounded-t-xl ${
                activeTab === 'notifications'
                  ? 'text-white bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-t-2 border-x-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2">
                <Bell className={`w-5 h-5 transition-transform duration-300 ${activeTab === 'notifications' ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span>Benachrichtigungen</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto p-6">
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl backdrop-blur-xl animate-in slide-in-from-top duration-500 ${
              message.type === 'success'
                ? 'bg-green-500/10 text-green-300 border border-green-500/30 shadow-lg shadow-green-500/10'
                : 'bg-red-500/10 text-red-300 border border-red-500/30 shadow-lg shadow-red-500/10'
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

            {/* Modern Stats Grid with Glassmorphism */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Arbeitstage Card */}
              <div className="group relative overflow-hidden rounded-2xl backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 p-6 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-500 hover:scale-[1.02] hover:border-blue-500/40">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors duration-300 group-hover:scale-110 transform">
                      <Calendar className="w-7 h-7 text-blue-400" />
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm font-medium mb-2 group-hover:text-slate-300 transition-colors">Arbeitstage</p>
                  <p className="text-5xl font-bold text-white mb-1 group-hover:scale-105 transition-transform">{stats.arbeitstage}</p>
                  <p className="text-blue-400/80 text-xs font-medium">Tage mit Einträgen</p>
                </div>
              </div>

              {/* Gesamtstunden Card */}
              <div className="group relative overflow-hidden rounded-2xl backdrop-blur-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 p-6 hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-500 hover:scale-[1.02] hover:border-emerald-500/40">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors duration-300 group-hover:scale-110 transform">
                      <Clock className="w-7 h-7 text-emerald-400" />
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm font-medium mb-2 group-hover:text-slate-300 transition-colors">Gesamtstunden</p>
                  <p className="text-5xl font-bold text-white mb-1 group-hover:scale-105 transition-transform">{stats.gesamtstunden}h</p>
                  <p className="text-emerald-400/80 text-xs font-medium">Im gewählten Monat</p>
                </div>
              </div>

              {/* Durchschnitt Card */}
              <div className="group relative overflow-hidden rounded-2xl backdrop-blur-xl bg-gradient-to-br from-amber-500/10 to-orange-600/10 border border-amber-500/20 p-6 hover:shadow-2xl hover:shadow-amber-500/20 transition-all duration-500 hover:scale-[1.02] hover:border-amber-500/40">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-amber-500/20 group-hover:bg-amber-500/30 transition-colors duration-300 group-hover:scale-110 transform">
                      <TrendingUp className="w-7 h-7 text-amber-400" />
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm font-medium mb-2 group-hover:text-slate-300 transition-colors">Durchschnitt</p>
                  <p className="text-5xl font-bold text-white mb-1 group-hover:scale-105 transition-transform">{stats.durchschnitt}h</p>
                  <p className="text-amber-400/80 text-xs font-medium">Stunden pro Tag</p>
                </div>
              </div>

              {/* Überstunden Card */}
              <div className="group relative overflow-hidden rounded-2xl backdrop-blur-xl bg-gradient-to-br from-violet-500/10 to-violet-600/10 border border-violet-500/20 p-6 hover:shadow-2xl hover:shadow-violet-500/20 transition-all duration-500 hover:scale-[1.02] hover:border-violet-500/40">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-violet-500/20 group-hover:bg-violet-500/30 transition-colors duration-300 group-hover:scale-110 transform">
                      <Clock className="w-7 h-7 text-violet-400" />
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm font-medium mb-2 group-hover:text-slate-300 transition-colors">Überstunden</p>
                  <p className="text-5xl font-bold text-white mb-1 group-hover:scale-105 transition-transform">{stats.uberstunden}h</p>
                  <p className="text-violet-400/80 text-xs font-medium">Stunden über 8h pro Tag</p>
                </div>
              </div>

              {/* Fehlende Tage Card */}
              <div className="group relative overflow-hidden rounded-2xl backdrop-blur-xl bg-gradient-to-br from-rose-500/10 to-rose-600/10 border border-rose-500/20 p-6 hover:shadow-2xl hover:shadow-rose-500/20 transition-all duration-500 hover:scale-[1.02] hover:border-rose-500/40 md:col-span-2 lg:col-span-1">
                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-rose-500/20 group-hover:bg-rose-500/30 transition-colors duration-300 group-hover:scale-110 transform">
                      <AlertCircle className="w-7 h-7 text-rose-400" />
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm font-medium mb-2 group-hover:text-slate-300 transition-colors">Fehlende Tage</p>
                  <p className="text-5xl font-bold text-white mb-1 group-hover:scale-105 transition-transform">{stats.fehlendeTage}</p>
                  <p className="text-rose-400/80 text-xs font-medium truncate">
                    {stats.fehlendeTageList.length > 0 ? stats.fehlendeTageList.join(', ') : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Most Used Vehicle Card */}
            {stats.mostUsedVehicle && (
              <div className="group relative overflow-hidden rounded-2xl backdrop-blur-xl bg-gradient-to-br from-cyan-500/10 to-teal-600/10 border border-cyan-500/20 p-6 hover:shadow-2xl hover:shadow-cyan-500/20 transition-all duration-500 hover:scale-[1.02] hover:border-cyan-500/40">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative flex items-center gap-5">
                  <div className="p-4 rounded-2xl bg-cyan-500/20 group-hover:bg-cyan-500/30 transition-colors duration-300 group-hover:scale-110 transform">
                    <Truck className="w-10 h-10 text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-400 text-sm font-medium mb-2 group-hover:text-slate-300 transition-colors">Meist genutztes Fahrzeug</p>
                    <p className="text-4xl font-bold text-white group-hover:scale-105 transition-transform">{stats.mostUsedVehicle}</p>
                  </div>
                </div>
              </div>
            )}

            {stats.entries === 0 && (
              <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-300 text-xl font-semibold">Keine Einträge für diesen Monat</p>
                <p className="text-gray-500 mt-2">Fügen Sie Ihre ersten Arbeitsstunden hinzu</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="backdrop-blur-xl bg-slate-800/50 rounded-2xl p-6 border border-white/10 shadow-lg">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-400" />
                Profilbild
              </h3>
              <div className="flex items-center gap-4">
                {getAvatarUrl(user?.avatar_url || null) ? (
                  <img
                    src={getAvatarUrl(user?.avatar_url || null)!}
                    alt="Profile"
                    className="w-20 h-20 rounded-full border-2 border-blue-500/30 object-cover ring-4 ring-blue-500/10"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-700/50 border-2 border-blue-500/30 flex items-center justify-center ring-4 ring-blue-500/10">
                    <User className="w-10 h-10 text-blue-400" />
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
                      className="block w-full text-sm text-slate-300
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-lg file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-500 file:text-white
                        hover:file:bg-blue-600
                        file:cursor-pointer file:transition
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </label>
                  <p className="mt-2 text-xs text-slate-400 font-medium">
                    {uploadingPhoto ? 'Wird hochgeladen...' : 'PNG, JPG bis zu 5MB'}
                  </p>
                </div>
              </div>
            </div>

            <div className="backdrop-blur-xl bg-slate-800/50 rounded-2xl p-6 border border-white/10 shadow-lg">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-cyan-400" />
                Ausweiscode
              </h3>
              <div className="space-y-4">
                {idBarcodePreview ? (
                  <div className="space-y-4">
                    <div className="relative inline-block cursor-pointer hover:ring-2 hover:ring-cyan-400 transition-all rounded-lg"
                      onClick={() => setShowBarcodeModal(true)}
                      title="Klicken für Vollbild"
                    >
                      <img
                        src={idBarcodePreview}
                        alt="ID Barcode"
                        className="max-w-full h-auto rounded-lg border-2 border-cyan-500/30 max-h-48 object-contain"
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
                          className={`block w-full text-center px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition cursor-pointer ${
                            uploadingIdBarcode ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {uploadingIdBarcode ? 'Wird hochgeladen...' : 'Bild ändern'}
                        </label>
                      </label>
                      <button
                        onClick={handleIdBarcodeRemove}
                        disabled={uploadingIdBarcode}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                        className="block w-full text-sm text-slate-300
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-lg file:border-0
                          file:text-sm file:font-semibold
                          file:bg-blue-500 file:text-white
                          hover:file:bg-blue-600
                          file:cursor-pointer file:transition
                          disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </label>
                    <p className="mt-2 text-xs text-slate-400 font-medium">
                      {uploadingIdBarcode ? 'Wird hochgeladen...' : 'PNG, JPG bis zu 5MB'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleNameUpdate} className="backdrop-blur-xl bg-slate-800/50 rounded-2xl p-6 border border-white/10 shadow-lg">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-400" />
                Anzeigename ändern
              </h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="displayName" className="block text-sm font-semibold text-slate-300 mb-2">
                    Neuer Name
                  </label>
                  <input
                    type="text"
                    id="displayName"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition placeholder:text-slate-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={updatingName}
                  className="w-full bg-blue-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-600 focus:ring-4 focus:ring-blue-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingName ? 'Wird aktualisiert...' : 'Name aktualisieren'}
                </button>
              </div>
            </form>

            <form onSubmit={handlePasswordChange} className="backdrop-blur-xl bg-slate-800/50 rounded-2xl p-6 border border-white/10 shadow-lg">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-rose-400" />
                Passwort ändern
              </h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-semibold text-slate-300 mb-2">
                    Aktuelles Passwort
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      id="currentPassword"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition pr-12 placeholder:text-slate-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="newPassword" className="block text-sm font-semibold text-slate-300 mb-2">
                    Neues Passwort
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition pr-12 placeholder:text-slate-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
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
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition pr-12"
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

      {idBarcodePreview && (
        <BarcodeModal
          isOpen={showBarcodeModal}
          onClose={() => setShowBarcodeModal(false)}
          imageUrl={idBarcodePreview}
          altText="Ausweiscode"
          label="Scannen Sie diesen Code"
        />
      )}
    </div>
  );
}
