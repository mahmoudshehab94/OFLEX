import { useState, useEffect } from 'react';
import { User, Lock, Camera, BarChart3, Calendar, Clock, Truck, ArrowLeft, LogOut, Eye, EyeOff, TrendingUp, Bell, CreditCard, X, AlertCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, hashPassword } from '../lib/supabase';
import { NotificationSettings } from './NotificationSettings';
import { BarcodeModal } from './BarcodeModal';

interface DriverStats {
  arbeitstage: number;
  gesamtstunden: number;
  durchschnitt: number;
  entries: number;
  fehlendeTage: number;
  fehlendeTageList: string[];
  uberstunden: number;
  mostUsedVehicle: string | null;
}

interface DriverInfo {
  driver_name: string;
  id_barcode_image_url: string | null;
}

interface DriverProfileProps {
  onBack: () => void;
}

interface WorkEntry {
  date: string;
  vehicle: string;
  start_time: string;
  end_time: string;
  hours_worked: number;
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

const calculateMonthStatistics = (entries: WorkEntry[], year: number, month: number): DriverStats => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
  const currentDay = isCurrentMonth ? today.getDate() : daysInMonth;

  const entriesWithDates = entries.map(e => ({
    ...e,
    dayOfMonth: parseInt(e.date.split('-')[2])
  }));

  const uniqueDays = new Set(entriesWithDates.map(e => e.dayOfMonth));
  const arbeitstage = uniqueDays.size;

  const gesamtstunden = entries.reduce((sum, e) => sum + e.hours_worked, 0);
  const durchschnitt = arbeitstage > 0 ? parseFloat((gesamtstunden / arbeitstage).toFixed(1)) : 0;

  const missingDays: number[] = [];
  for (let day = 1; day <= currentDay; day++) {
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !uniqueDays.has(day)) {
      missingDays.push(day);
    }
  }

  const uberstunden = entries.reduce((sum, e) => {
    const overtime = Math.max(0, e.hours_worked - 8);
    return sum + overtime;
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

  return {
    arbeitstage,
    gesamtstunden: parseFloat(gesamtstunden.toFixed(1)),
    durchschnitt,
    entries: entries.length,
    fehlendeTage: missingDays.length,
    fehlendeTageList: missingDays.map(d => d.toString()),
    uberstunden: parseFloat(uberstunden.toFixed(1)),
    mostUsedVehicle
  };
};

export function DriverProfileModern({ onBack }: DriverProfileProps) {
  const { user, logout, updateUserAvatar } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings' | 'notifications'>('dashboard');
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);

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
        .lte('date', endDateStr)
        .order('date', { ascending: true });

      setWorkEntries(entries || []);
      const calculatedStats = calculateMonthStatistics(entries || [], selectedYear, selectedMonth);
      setStats(calculatedStats);
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
          await supabase.storage.from('avatars').remove([`${user.id}/${oldPath}`]);
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = publicUrlData.publicUrl;

      const result = await updateUserProfileAPI(user.id, { avatar_url: publicUrl });

      if (!result.success) throw new Error(result.error || 'Failed to update avatar');

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
          await supabase.storage.from('avatars').remove([`${user.id}/id_barcode_${oldPath}`]);
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `id_barcode_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
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
        await supabase.storage.from('avatars').remove([`${user.id}/${oldPath}`]);
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

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  const getCalendarDays = () => {
    const firstDay = new Date(selectedYear, selectedMonth - 1, 1);
    const lastDay = new Date(selectedYear, selectedMonth, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = [];

    for (let i = 0; i < (startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1); i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  const getEntriesForDay = (day: number) => {
    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return workEntries.filter(e => e.date === dateStr);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E8E5DD] flex items-center justify-center">
        <div className="text-gray-800 text-xl">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E8E5DD] flex">
      <div className="w-64 bg-[#1A1A1A] text-white flex flex-col">
        <div className="p-6">
          <h2 className="text-xl font-bold tracking-wider">TRANSOFLEX</h2>
        </div>

        <nav className="flex-1 px-4">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-lg transition-all ${
              activeTab === 'dashboard'
                ? 'bg-gradient-to-r from-[#8B7355]/20 to-transparent border-l-4 border-[#8B7355]'
                : 'hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-sm font-medium">DASHBOARD</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-lg transition-all ${
              activeTab === 'settings'
                ? 'bg-gradient-to-r from-[#8B7355]/20 to-transparent border-l-4 border-[#8B7355]'
                : 'hover:bg-white/5'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-sm font-medium">EINSTELLUNGEN</span>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-lg transition-all ${
              activeTab === 'notifications'
                ? 'bg-gradient-to-r from-[#8B7355]/20 to-transparent border-l-4 border-[#8B7355]'
                : 'hover:bg-white/5'
            }`}
          >
            <Bell className="w-5 h-5" />
            <span className="text-sm font-medium">BENACHRICHTIGUNGEN</span>
          </button>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 px-2 py-3">
            {getAvatarUrl(user?.avatar_url || null) ? (
              <img
                src={getAvatarUrl(user?.avatar_url || null)!}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#8B7355] flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.username}</p>
              <p className="text-xs text-gray-400">FAHRER</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Hallo {user?.username}</h1>
              <button
                onClick={onBack}
                className="text-sm text-gray-600 hover:text-gray-900 mt-1 flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                ZURÜCK ZUR ÜBERSICHT
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 bg-white rounded-full hover:bg-gray-100 transition">
                <Search className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={logout}
                className="p-2 bg-white rounded-full hover:bg-gray-100 transition"
              >
                <LogOut className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {message && (
            <div
              className={`mb-6 p-4 rounded-2xl ${
                message.type === 'success'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}

          {activeTab === 'dashboard' && stats && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">{driverInfo?.driver_name}</h3>
                </div>
                <div className="flex justify-center mb-6">
                  {getAvatarUrl(user?.avatar_url || null) ? (
                    <img
                      src={getAvatarUrl(user?.avatar_url || null)!}
                      alt="Profile"
                      className="w-48 h-48 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <User className="w-24 h-24 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">POSITION</span>
                    <span className="font-semibold text-gray-900">FAHRER</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Arbeitsformat</h3>
                </div>
                <div className="flex items-center justify-center my-8">
                  <div className="relative w-48 h-48">
                    <svg className="transform -rotate-90 w-48 h-48">
                      <circle
                        cx="96"
                        cy="96"
                        r="80"
                        stroke="#E8E5DD"
                        strokeWidth="16"
                        fill="none"
                      />
                      <circle
                        cx="96"
                        cy="96"
                        r="80"
                        stroke="#8B7355"
                        strokeWidth="16"
                        fill="none"
                        strokeDasharray={`${(stats.gesamtstunden / 200) * 502} 502`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-4xl font-bold text-gray-900">{stats.gesamtstunden}</div>
                      <div className="text-sm text-gray-600">STUNDEN</div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full bg-[#8B7355]"></div>
                      <span className="text-xs text-gray-600">Arbeitstage</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{stats.arbeitstage}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full bg-[#D4AF87]"></div>
                      <span className="text-xs text-gray-600">Durchschnitt</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{stats.durchschnitt}h</div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#F5F3ED] to-[#E8E5DD] rounded-3xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Statistiken</h3>
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Arbeitstage</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.arbeitstage}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <Clock className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Gesamtstunden</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.gesamtstunden}h</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Durchschnitt</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.durchschnitt}h</p>
                      </div>
                    </div>
                  </div>

                  {stats.mostUsedVehicle && (
                    <div className="bg-white rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                          <Truck className="w-6 h-6 text-yellow-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Fahrzeug</p>
                          <p className="text-lg font-bold text-gray-900">{stats.mostUsedVehicle}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={handlePrevMonth}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h3 className="text-2xl font-bold text-gray-900">{monthNames[selectedMonth - 1]} {selectedYear}</h3>
                  <button
                    onClick={handleNextMonth}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2 mb-4">
                  {['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'].map(day => (
                    <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {getCalendarDays().map((day, index) => {
                    if (day === null) {
                      return <div key={`empty-${index}`} className="aspect-square" />;
                    }

                    const dayEntries = getEntriesForDay(day);
                    const hasEntry = dayEntries.length > 0;
                    const totalHours = dayEntries.reduce((sum, e) => sum + e.hours_worked, 0);

                    return (
                      <div
                        key={day}
                        className={`aspect-square rounded-xl p-2 flex flex-col items-center justify-center text-sm transition-all ${
                          hasEntry
                            ? 'bg-[#1A1A1A] text-white cursor-pointer hover:scale-105'
                            : 'bg-gray-50 text-gray-400'
                        }`}
                      >
                        <div className="font-bold">{day}</div>
                        {hasEntry && (
                          <div className="text-xs mt-1">{totalHours}h</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Monatsbericht</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Fehlende Tage</span>
                    <span className="text-2xl font-bold text-gray-900">{stats.fehlendeTage}</span>
                  </div>
                  <div className="h-px bg-gray-200"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Überstunden</span>
                    <span className="text-2xl font-bold text-gray-900">{stats.uberstunden}h</span>
                  </div>
                  <div className="h-px bg-gray-200"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Einträge</span>
                    <span className="text-2xl font-bold text-gray-900">{stats.entries}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-4xl space-y-6">
              <div className="bg-white rounded-3xl p-8 shadow-sm">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <Camera className="w-6 h-6" />
                  Profilbild
                </h3>
                <div className="flex items-center gap-6">
                  {getAvatarUrl(user?.avatar_url || null) ? (
                    <img
                      src={getAvatarUrl(user?.avatar_url || null)!}
                      alt="Profile"
                      className="w-32 h-32 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <User className="w-16 h-16 text-gray-400" />
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
                        className="block w-full text-sm text-gray-600
                          file:mr-4 file:py-3 file:px-6
                          file:rounded-2xl file:border-0
                          file:text-sm file:font-semibold
                          file:bg-[#1A1A1A] file:text-white
                          hover:file:bg-[#2A2A2A]
                          file:cursor-pointer file:transition
                          disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </label>
                    <p className="mt-3 text-sm text-gray-500">
                      {uploadingPhoto ? 'Wird hochgeladen...' : 'PNG, JPG bis zu 5MB'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-8 shadow-sm">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <CreditCard className="w-6 h-6" />
                  Ausweiscode
                </h3>
                <div className="space-y-4">
                  {idBarcodePreview ? (
                    <div className="space-y-4">
                      <div
                        className="relative inline-block cursor-pointer hover:opacity-90 transition rounded-2xl"
                        onClick={() => setShowBarcodeModal(true)}
                      >
                        <img
                          src={idBarcodePreview}
                          alt="ID Barcode"
                          className="max-w-full h-auto rounded-2xl max-h-48 object-contain"
                        />
                      </div>
                      <div className="flex gap-3">
                        <label className="flex-1">
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
                            className={`block w-full text-center px-6 py-3 bg-[#1A1A1A] text-white rounded-2xl font-semibold hover:bg-[#2A2A2A] transition cursor-pointer ${
                              uploadingIdBarcode ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            {uploadingIdBarcode ? 'Wird hochgeladen...' : 'Bild ändern'}
                          </label>
                        </label>
                        <button
                          onClick={handleIdBarcodeRemove}
                          disabled={uploadingIdBarcode}
                          className="px-6 py-3 bg-red-600 text-white rounded-2xl font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <X className="w-5 h-5" />
                          Entfernen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleIdBarcodeUpload}
                          disabled={uploadingIdBarcode}
                          className="block w-full text-sm text-gray-600
                            file:mr-4 file:py-3 file:px-6
                            file:rounded-2xl file:border-0
                            file:text-sm file:font-semibold
                            file:bg-[#1A1A1A] file:text-white
                            hover:file:bg-[#2A2A2A]
                            file:cursor-pointer file:transition
                            disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </label>
                      <p className="mt-3 text-sm text-gray-500">
                        {uploadingIdBarcode ? 'Wird hochgeladen...' : 'PNG, JPG bis zu 5MB'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <form onSubmit={handleNameUpdate} className="bg-white rounded-3xl p-8 shadow-sm">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <User className="w-6 h-6" />
                  Anzeigename ändern
                </h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="displayName" className="block text-sm font-semibold text-gray-700 mb-3">
                      Neuer Name
                    </label>
                    <input
                      type="text"
                      id="displayName"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      className="w-full px-5 py-4 bg-gray-50 border-0 text-gray-900 rounded-2xl focus:ring-2 focus:ring-[#8B7355] transition text-lg"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={updatingName}
                    className="w-full bg-[#1A1A1A] text-white py-4 px-6 rounded-2xl font-semibold hover:bg-[#2A2A2A] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingName ? 'Wird aktualisiert...' : 'Name aktualisieren'}
                  </button>
                </div>
              </form>

              <form onSubmit={handlePasswordChange} className="bg-white rounded-3xl p-8 shadow-sm">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <Lock className="w-6 h-6" />
                  Passwort ändern
                </h3>
                <div className="space-y-5">
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-semibold text-gray-700 mb-3">
                      Aktuelles Passwort
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        id="currentPassword"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-5 py-4 bg-gray-50 border-0 text-gray-900 rounded-2xl focus:ring-2 focus:ring-[#8B7355] transition pr-14 text-lg"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-700 mb-3">
                      Neues Passwort
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        id="newPassword"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-5 py-4 bg-gray-50 border-0 text-gray-900 rounded-2xl focus:ring-2 focus:ring-[#8B7355] transition pr-14 text-lg"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-3">
                      Neues Passwort bestätigen
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-5 py-4 bg-gray-50 border-0 text-gray-900 rounded-2xl focus:ring-2 focus:ring-[#8B7355] transition pr-14 text-lg"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="w-full bg-[#1A1A1A] text-white py-4 px-6 rounded-2xl font-semibold hover:bg-[#2A2A2A] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {changingPassword ? 'Wird geändert...' : 'Passwort ändern'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'notifications' && user && (
            <div className="max-w-4xl">
              <div className="bg-white rounded-3xl p-8 shadow-sm">
                <NotificationSettings
                  userAccountId={user.id}
                  role="driver"
                  driverId={user.driver_id}
                />
              </div>
            </div>
          )}
        </div>
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
