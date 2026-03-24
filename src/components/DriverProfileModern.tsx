import { useState, useEffect } from 'react';
import { User, Lock, Camera, BarChart3, Calendar, Clock, Truck, ArrowLeft, LogOut, Eye, EyeOff, TrendingUp, Bell, CreditCard, X, AlertCircle, Search, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
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

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
      <div className="min-h-screen bg-[#D9D9D9] flex items-center justify-center">
        <div className="text-gray-800 text-xl">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#D9D9D9] flex">
      {/* Black Sidebar */}
      <div className="w-72 bg-[#0A0A0A] text-white flex flex-col">
        <div className="p-8">
          <h2 className="text-xl font-bold tracking-widest">TRANSOFLEX</h2>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl transition-all text-sm ${
              activeTab === 'dashboard'
                ? 'bg-[#2A2A2A] text-white'
                : 'text-gray-400 hover:text-white hover:bg-[#1A1A1A]'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="font-medium tracking-wide">DASHBOARD</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl transition-all text-sm ${
              activeTab === 'settings'
                ? 'bg-[#2A2A2A] text-white'
                : 'text-gray-400 hover:text-white hover:bg-[#1A1A1A]'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium tracking-wide">EINSTELLUNGEN</span>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl transition-all text-sm ${
              activeTab === 'notifications'
                ? 'bg-[#2A2A2A] text-white'
                : 'text-gray-400 hover:text-white hover:bg-[#1A1A1A]'
            }`}
          >
            <Bell className="w-5 h-5" />
            <span className="font-medium tracking-wide">BENACHRICHTIGUNGEN</span>
          </button>
        </nav>

        <div className="p-6 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            {getAvatarUrl(user?.avatar_url || null) ? (
              <img
                src={getAvatarUrl(user?.avatar_url || null)!}
                alt="Profile"
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#2A2A2A] flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.username}</p>
              <p className="text-xs text-gray-400 uppercase tracking-wide">FAHRER</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-10">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-5xl font-bold text-gray-900 mb-2">Hallo {user?.username?.split(' ')[0] || user?.username}</h1>
              <button
                onClick={onBack}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1.5 uppercase tracking-wider"
              >
                <ArrowLeft className="w-4 h-4" />
                ZURÜCK ZUR ÜBERSICHT
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-3 bg-white rounded-full hover:bg-gray-100 transition shadow-sm">
                <Search className="w-5 h-5 text-gray-700" />
              </button>
              <button className="p-3 bg-white rounded-full hover:bg-gray-100 transition shadow-sm">
                <Bell className="w-5 h-5 text-gray-700" />
              </button>
              <button
                onClick={logout}
                className="p-3 bg-white rounded-full hover:bg-gray-100 transition shadow-sm"
              >
                <LogOut className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          </div>

          {message && (
            <div
              className={`mb-6 p-5 rounded-3xl ${
                message.type === 'success'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          {activeTab === 'dashboard' && stats && (
            <div className="grid grid-cols-3 gap-6">
              {/* Profile Card */}
              <div className="bg-[#E8E5D8] rounded-[32px] p-8 shadow-sm">
                {getAvatarUrl(user?.avatar_url || null) ? (
                  <img
                    src={getAvatarUrl(user?.avatar_url || null)!}
                    alt="Profile"
                    className="w-full aspect-[3/4] object-cover rounded-3xl mb-6"
                  />
                ) : (
                  <div className="w-full aspect-[3/4] bg-gradient-to-br from-gray-200 to-gray-300 rounded-3xl mb-6 flex items-center justify-center">
                    <User className="w-24 h-24 text-gray-400" />
                  </div>
                )}
                <h3 className="text-3xl font-bold text-gray-900 mb-2">{driverInfo?.driver_name}</h3>
                <p className="text-sm text-gray-600 uppercase tracking-wider">FAHRER</p>
              </div>

              {/* Working Format Card */}
              <div className="bg-[#E8E5D8] rounded-[32px] p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Working format</h3>
                  <button className="text-gray-600 hover:text-gray-900">
                    <span className="text-2xl">⋮</span>
                  </button>
                </div>
                <div className="flex items-center justify-center my-10">
                  <div className="relative w-56 h-56">
                    <svg className="transform -rotate-90 w-56 h-56">
                      <circle
                        cx="112"
                        cy="112"
                        r="90"
                        stroke="#C8E6C9"
                        strokeWidth="20"
                        fill="none"
                        opacity="0.3"
                      />
                      <circle
                        cx="112"
                        cy="112"
                        r="90"
                        stroke="#81C784"
                        strokeWidth="20"
                        fill="none"
                        strokeDasharray={`${(stats.arbeitstage / 30) * 565} 565`}
                        strokeLinecap="round"
                      />
                      <circle
                        cx="112"
                        cy="112"
                        r="70"
                        stroke="#FFD54F"
                        strokeWidth="20"
                        fill="none"
                        strokeDasharray={`${(stats.durchschnitt / 12) * 440} 440`}
                        strokeLinecap="round"
                      />
                      <circle
                        cx="112"
                        cy="112"
                        r="50"
                        stroke="#E1BEE7"
                        strokeWidth="20"
                        fill="none"
                        strokeDasharray={`${(stats.uberstunden / stats.gesamtstunden) * 314} 314`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-5xl font-bold text-gray-900">{stats.arbeitstage}</div>
                      <div className="text-sm text-gray-600 uppercase tracking-wider mt-1">TAGE</div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-8">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#81C784]"></div>
                    <div>
                      <p className="text-xs text-gray-600">Arbeitstage</p>
                      <p className="text-sm font-bold text-gray-900">{stats.arbeitstage}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#FFD54F]"></div>
                    <div>
                      <p className="text-xs text-gray-600">Durchschnitt</p>
                      <p className="text-sm font-bold text-gray-900">{stats.durchschnitt}h</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#E1BEE7]"></div>
                    <div>
                      <p className="text-xs text-gray-600">Überstunden</p>
                      <p className="text-sm font-bold text-gray-900">{stats.uberstunden}h</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#90CAF9]"></div>
                    <div>
                      <p className="text-xs text-gray-600">Total</p>
                      <p className="text-sm font-bold text-gray-900">{stats.gesamtstunden}h</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tasks Card */}
              <div className="bg-[#E8E5D8] rounded-[32px] p-8 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-gray-900">Monatsbericht</h3>
                  <div className="text-right">
                    <div className="text-4xl font-bold text-gray-900">{Math.round((stats.arbeitstage / 22) * 100)}%</div>
                    <div className="text-xs text-gray-600 uppercase tracking-wider">FORTSCHRITT</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                  <div className="h-3 bg-gradient-to-r from-yellow-200 via-yellow-300 to-green-400 rounded-full"></div>
                </div>

                {/* Stats List */}
                <div className="space-y-4">
                  <div className="bg-white/60 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-8 h-8 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Arbeitstage</p>
                      <p className="text-xl font-bold text-gray-900">{stats.arbeitstage}</p>
                    </div>
                  </div>

                  <div className="bg-white/60 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Clock className="w-8 h-8 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Gesamtstunden</p>
                      <p className="text-xl font-bold text-gray-900">{stats.gesamtstunden}h</p>
                    </div>
                  </div>

                  <div className="bg-white/60 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Fehlende Tage</p>
                      <p className="text-xl font-bold text-gray-900">{stats.fehlendeTage}</p>
                    </div>
                  </div>

                  {stats.mostUsedVehicle && (
                    <div className="bg-white/60 rounded-2xl p-4 flex items-center gap-4">
                      <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <Truck className="w-8 h-8 text-yellow-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Fahrzeug</p>
                        <p className="text-lg font-bold text-gray-900">{stats.mostUsedVehicle}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Calendar Card - Spans 2 columns */}
              <div className="col-span-2 bg-[#E8E5D8] rounded-[32px] p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <button
                    onClick={handlePrevMonth}
                    className="p-2 hover:bg-white/50 rounded-lg transition"
                  >
                    <ChevronLeft className="w-6 h-6 text-gray-700" />
                  </button>
                  <h3 className="text-3xl font-bold text-gray-900">{monthNames[selectedMonth - 1]} {selectedYear}</h3>
                  <button
                    onClick={handleNextMonth}
                    className="p-2 hover:bg-white/50 rounded-lg transition"
                  >
                    <ChevronRight className="w-6 h-6 text-gray-700" />
                  </button>
                </div>

                {/* Time labels */}
                <div className="flex mb-4 text-sm text-gray-600">
                  <div className="w-24 flex-shrink-0"></div>
                  <div className="grid grid-cols-7 gap-2 flex-1">
                    {['MON.3', 'TUE.4', 'WED.5', 'THU.6', 'FRI.7', 'SAT.8', 'SUN.9'].map(day => (
                      <div key={day} className="text-center text-xs uppercase tracking-wider">
                        {day}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="space-y-1">
                  {['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM'].map((time, idx) => (
                    <div key={time} className="flex items-center">
                      <div className="w-24 flex-shrink-0 text-xs text-gray-600 pr-4 text-right">{time}</div>
                      <div className="grid grid-cols-7 gap-2 flex-1">
                        {[...Array(7)].map((_, dayIdx) => {
                          const hasEvent = idx === 1 && dayIdx === 0;
                          return (
                            <div
                              key={dayIdx}
                              className={`h-12 rounded-xl ${
                                hasEvent ? 'bg-[#0A0A0A] flex items-center justify-center' : ''
                              }`}
                            >
                              {hasEvent && (
                                <div className="text-white text-xs px-2 py-1">
                                  <div className="font-semibold">ARBEIT</div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Stats Cards */}
              <div className="bg-[#E8E5D8] rounded-[32px] p-8 shadow-sm">
                <h4 className="text-5xl font-bold text-gray-900 mb-2">{stats.arbeitstage}</h4>
                <p className="text-sm text-gray-600 uppercase tracking-wider mb-1">TAGE IM UNTERNEHMEN</p>
                <p className="text-xs text-green-600 font-semibold">+8% LETZTER MONAT</p>
              </div>

              <div className="bg-[#F5EDD8] rounded-[32px] p-8 shadow-sm">
                <h4 className="text-5xl font-bold text-gray-900 mb-2">{stats.entries}</h4>
                <p className="text-sm text-gray-600 uppercase tracking-wider mb-1">ABGESCHLOSSENE SCHICHTEN</p>
                <p className="text-xs text-green-600 font-semibold">+4 LETZTER MONAT</p>
              </div>

              <div className="bg-[#E8DDD8] rounded-[32px] p-8 shadow-sm">
                <h4 className="text-5xl font-bold text-gray-900 mb-2">{stats.fehlendeTage}</h4>
                <p className="text-sm text-gray-600 uppercase tracking-wider mb-1">SCHICHTEN IM GANGE</p>
                <p className="text-xs text-orange-600 font-semibold">+3 LETZTER MONAT</p>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-5xl space-y-6">
              <div className="bg-[#E8E5D8] rounded-[32px] p-10 shadow-sm">
                <h3 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                  <Camera className="w-8 h-8" />
                  Profilbild
                </h3>
                <div className="flex items-center gap-8">
                  {getAvatarUrl(user?.avatar_url || null) ? (
                    <img
                      src={getAvatarUrl(user?.avatar_url || null)!}
                      alt="Profile"
                      className="w-40 h-40 rounded-3xl object-cover"
                    />
                  ) : (
                    <div className="w-40 h-40 rounded-3xl bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                      <User className="w-20 h-20 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhoto}
                        className="block w-full text-base text-gray-700
                          file:mr-4 file:py-4 file:px-8
                          file:rounded-3xl file:border-0
                          file:text-sm file:font-semibold
                          file:bg-[#0A0A0A] file:text-white
                          hover:file:bg-[#1A1A1A]
                          file:cursor-pointer file:transition
                          disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </label>
                    <p className="mt-4 text-sm text-gray-600">
                      {uploadingPhoto ? 'Wird hochgeladen...' : 'PNG, JPG bis zu 5MB'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#E8E5D8] rounded-[32px] p-10 shadow-sm">
                <h3 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                  <CreditCard className="w-8 h-8" />
                  Ausweiscode
                </h3>
                <div className="space-y-6">
                  {idBarcodePreview ? (
                    <div className="space-y-4">
                      <div
                        className="relative inline-block cursor-pointer hover:opacity-90 transition rounded-3xl"
                        onClick={() => setShowBarcodeModal(true)}
                      >
                        <img
                          src={idBarcodePreview}
                          alt="ID Barcode"
                          className="max-w-full h-auto rounded-3xl max-h-64 object-contain"
                        />
                      </div>
                      <div className="flex gap-4">
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
                            className={`block w-full text-center px-8 py-4 bg-[#0A0A0A] text-white rounded-3xl font-semibold hover:bg-[#1A1A1A] transition cursor-pointer ${
                              uploadingIdBarcode ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            {uploadingIdBarcode ? 'Wird hochgeladen...' : 'Bild ändern'}
                          </label>
                        </label>
                        <button
                          onClick={handleIdBarcodeRemove}
                          disabled={uploadingIdBarcode}
                          className="px-8 py-4 bg-red-600 text-white rounded-3xl font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
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
                          className="block w-full text-base text-gray-700
                            file:mr-4 file:py-4 file:px-8
                            file:rounded-3xl file:border-0
                            file:text-sm file:font-semibold
                            file:bg-[#0A0A0A] file:text-white
                            hover:file:bg-[#1A1A1A]
                            file:cursor-pointer file:transition
                            disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </label>
                      <p className="mt-4 text-sm text-gray-600">
                        {uploadingIdBarcode ? 'Wird hochgeladen...' : 'PNG, JPG bis zu 5MB'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <form onSubmit={handleNameUpdate} className="bg-[#E8E5D8] rounded-[32px] p-10 shadow-sm">
                <h3 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                  <User className="w-8 h-8" />
                  Anzeigename ändern
                </h3>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="displayName" className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                      Neuer Name
                    </label>
                    <input
                      type="text"
                      id="displayName"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      className="w-full px-6 py-5 bg-white border-0 text-gray-900 rounded-3xl focus:ring-2 focus:ring-gray-400 transition text-lg"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={updatingName}
                    className="w-full bg-[#0A0A0A] text-white py-5 px-8 rounded-3xl font-semibold text-lg hover:bg-[#1A1A1A] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingName ? 'Wird aktualisiert...' : 'Name aktualisieren'}
                  </button>
                </div>
              </form>

              <form onSubmit={handlePasswordChange} className="bg-[#E8E5D8] rounded-[32px] p-10 shadow-sm">
                <h3 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                  <Lock className="w-8 h-8" />
                  Passwort ändern
                </h3>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                      Aktuelles Passwort
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        id="currentPassword"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-6 py-5 bg-white border-0 text-gray-900 rounded-3xl focus:ring-2 focus:ring-gray-400 transition pr-14 text-lg"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                      Neues Passwort
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        id="newPassword"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-6 py-5 bg-white border-0 text-gray-900 rounded-3xl focus:ring-2 focus:ring-gray-400 transition pr-14 text-lg"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                      Neues Passwort bestätigen
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-6 py-5 bg-white border-0 text-gray-900 rounded-3xl focus:ring-2 focus:ring-gray-400 transition pr-14 text-lg"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="w-full bg-[#0A0A0A] text-white py-5 px-8 rounded-3xl font-semibold text-lg hover:bg-[#1A1A1A] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {changingPassword ? 'Wird geändert...' : 'Passwort ändern'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'notifications' && user && (
            <div className="max-w-5xl">
              <div className="bg-[#E8E5D8] rounded-[32px] p-10 shadow-sm">
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
