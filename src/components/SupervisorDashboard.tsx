import { useState, useEffect } from 'react';
import {
  Users,
  LogOut,
  UserPlus,
  Trash2,
  Power,
  PowerOff,
  CheckCircle2,
  XCircle,
  Search,
  Moon,
  Sun,
  TrendingUp,
  User,
  Pencil,
  Save,
  X as XIcon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDarkMode } from '../hooks/useDarkMode';
import { supabase, Driver, getDriversWithAccounts, updateUserEmail } from '../lib/supabase';
import { InviteManagement } from './InviteManagement';
import { DirectAccountCreation } from './DirectAccountCreation';
import { SupervisorProfile } from './SupervisorProfile';
import { hasPermission } from '../lib/permissions';

type Tab = 'drivers' | 'attendance' | 'invites' | 'profile';

export function SupervisorDashboard() {
  const { user, logout } = useAuth();
  const { isDark, toggleDarkMode } = useDarkMode();
  const [activeTab, setActiveTab] = useState<Tab>('attendance');

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [editingDriver, setEditingDriver] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    driver_name: string;
    license_letters: string;
    license_numbers: string;
    email: string;
  }>({
    driver_name: '',
    license_letters: '',
    license_numbers: '',
    email: ''
  });
  const [savingDriver, setSavingDriver] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [attendanceData, setAttendanceData] = useState<{
    driver_id: string;
    driver_name: string;
    has_entry: boolean;
    last_entry?: string;
  }[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'supervisor') {
      window.history.pushState({}, '', '/');
      window.location.reload();
      return;
    }
    loadDrivers();
    loadAttendance();
  }, [user]);

  const loadDrivers = async () => {
    if (!supabase) return;

    setLoading(true);
    const result = await getDriversWithAccounts();

    if (result.success && result.drivers) {
      const sortedDrivers = result.drivers.sort((a, b) =>
        a.driver_name.localeCompare(b.driver_name)
      );
      setDrivers(sortedDrivers);
    }
    setLoading(false);
  };

  const loadAttendance = async () => {
    if (!supabase) return;

    setAttendanceLoading(true);

    const today = new Date().toISOString().split('T')[0];

    const { data: driversData, error: driversError } = await supabase
      .from('drivers')
      .select('id, driver_name')
      .eq('is_active', true)
      .order('driver_name');

    if (driversError || !driversData) {
      setAttendanceLoading(false);
      return;
    }

    const { data: entriesData, error: entriesError } = await supabase
      .from('work_entries')
      .select('driver_id, created_at')
      .eq('date', today)
      .order('created_at', { ascending: false });

    if (entriesError) {
      setAttendanceLoading(false);
      return;
    }

    const attendanceMap = new Map();
    entriesData?.forEach(entry => {
      if (!attendanceMap.has(entry.driver_id)) {
        attendanceMap.set(entry.driver_id, entry.created_at);
      }
    });

    const attendance = driversData.map(driver => ({
      driver_id: driver.id,
      driver_name: driver.driver_name,
      has_entry: attendanceMap.has(driver.id),
      last_entry: attendanceMap.get(driver.id)
    }));

    setAttendanceData(attendance);
    setAttendanceLoading(false);
  };

  const handleEditDriver = (driver: Driver) => {
    setEditingDriver(driver.id);
    setEditFormData({
      driver_name: driver.driver_name,
      license_letters: driver.license_letters || '',
      license_numbers: driver.license_numbers || '',
      email: driver.account_email || ''
    });
    setMessage(null);
  };

  const handleCancelEdit = () => {
    setEditingDriver(null);
    setEditFormData({
      driver_name: '',
      license_letters: '',
      license_numbers: '',
      email: ''
    });
  };

  const handleSaveDriver = async (driverId: string) => {
    if (!supabase) return;

    if (!editFormData.driver_name) {
      setMessage({ type: 'error', text: 'Fahrername ist erforderlich' });
      return;
    }

    setSavingDriver(true);
    setMessage(null);

    const { error: driverError } = await supabase
      .from('drivers')
      .update({
        driver_name: editFormData.driver_name,
        license_letters: editFormData.license_letters || null,
        license_numbers: editFormData.license_numbers || null
      })
      .eq('id', driverId);

    if (driverError) {
      setMessage({ type: 'error', text: driverError.message });
      setSavingDriver(false);
      return;
    }

    const driver = drivers.find(d => d.id === driverId);
    if (driver?.account_id && editFormData.email && editFormData.email !== driver.account_email && user) {
      const result = await updateUserEmail(
        driver.account_id,
        editFormData.email,
        user.id
      );

      if (!result.success) {
        setMessage({ type: 'error', text: `Fahrer aktualisiert, aber E-Mail-Aktualisierung fehlgeschlagen: ${result.error}` });
        setSavingDriver(false);
        await loadDrivers();
        setEditingDriver(null);
        return;
      }
    }

    setMessage({ type: 'success', text: 'Fahrer erfolgreich aktualisiert' });
    await loadDrivers();
    await loadAttendance();
    setEditingDriver(null);
    setSavingDriver(false);
  };

  const handleToggleDriverStatus = async (driver: Driver) => {
    if (!supabase) return;

    if (!hasPermission(user?.role || null, 'canManageDriverStatus')) {
      setMessage({ type: 'error', text: 'Sie haben keine Berechtigung, den Fahrerstatus zu verwalten' });
      return;
    }

    const action = driver.is_active ? 'deaktivieren' : 'aktivieren';
    if (!confirm(`Sind Sie sicher, dass Sie ${driver.driver_name} ${action} möchten?`)) {
      return;
    }

    const { error } = await supabase
      .from('drivers')
      .update({ is_active: !driver.is_active })
      .eq('id', driver.id);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: `Fahrer erfolgreich ${action === 'aktivieren' ? 'aktiviert' : 'deaktiviert'}` });
      await loadDrivers();
      await loadAttendance();
    }
  };

  const handleDeleteDriver = async (driverId: string, driverName: string) => {
    if (!supabase) return;

    if (!hasPermission(user?.role || null, 'canDeleteDrivers')) {
      setMessage({ type: 'error', text: 'Sie haben keine Berechtigung, Fahrer zu löschen' });
      return;
    }

    if (!confirm(`Sind Sie sicher, dass Sie ${driverName} dauerhaft löschen möchten? Ihr Benutzerkonto wird ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      return;
    }

    const { error } = await supabase
      .from('drivers')
      .delete()
      .eq('id', driverId);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Fahrer erfolgreich gelöscht' });
      await loadDrivers();
      await loadAttendance();
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const filteredDrivers = drivers.filter(driver =>
    driver.driver_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAttendance = attendanceData.filter(att =>
    att.driver_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user || user.role !== 'supervisor') {
    return null;
  }

  const permissions = hasPermission(user.role, 'canCreateDrivers');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
      <header className="relative backdrop-blur-xl bg-gradient-to-br from-slate-800/90 via-slate-900/90 to-slate-800/90 border-b border-white/10 shadow-2xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <div className="relative p-3 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl border border-emerald-500/30">
                  <Users className="w-7 h-7 text-emerald-400" />
                </div>
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-white via-emerald-100 to-teal-200 bg-clip-text text-transparent tracking-tight">Supervisor-Dashboard</h1>
                <p className="text-sm text-slate-400 font-medium">{user.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleDarkMode} className="group px-3 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition-all duration-300 border border-white/10 hover:border-white/20 hover:scale-105" aria-label="Toggle dark mode">
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button onClick={handleLogout} className="group flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all duration-300 border border-red-500/20 hover:border-red-500/30 hover:shadow-lg hover:shadow-red-500/20 hover:scale-105">
                <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                <span className="font-medium">Abmelden</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 z-10">
        {message && (
          <div className={`mb-6 p-4 rounded-xl backdrop-blur-xl animate-in slide-in-from-top duration-500 ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-300 border border-green-500/30 shadow-lg shadow-green-500/10'
              : 'bg-red-500/10 text-red-300 border border-red-500/30 shadow-lg shadow-red-500/10'
          }`}>
            {message.text}
          </div>
        )}

        <div className="mb-6 backdrop-blur-xl bg-slate-900/50 rounded-2xl border border-white/5 p-2 inline-flex gap-2">
          <button onClick={() => setActiveTab('attendance')} className={`group px-4 py-3 font-semibold text-sm rounded-xl transition-all duration-300 flex items-center gap-2 ${activeTab === 'attendance' ? 'text-white bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
            <TrendingUp className={`w-5 h-5 transition-transform duration-300 ${activeTab === 'attendance' ? 'scale-110' : 'group-hover:scale-110'}`} />
            Anwesenheitserfassung
          </button>
          <button onClick={() => setActiveTab('drivers')} className={`group px-4 py-3 font-semibold text-sm rounded-xl transition-all duration-300 flex items-center gap-2 ${activeTab === 'drivers' ? 'text-white bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
            <Users className={`w-5 h-5 transition-transform duration-300 ${activeTab === 'drivers' ? 'scale-110' : 'group-hover:scale-110'}`} />
            Fahrer
          </button>
          <button onClick={() => setActiveTab('invites')} className={`group px-4 py-3 font-semibold text-sm rounded-xl transition-all duration-300 flex items-center gap-2 ${activeTab === 'invites' ? 'text-white bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
            <UserPlus className={`w-5 h-5 transition-transform duration-300 ${activeTab === 'invites' ? 'scale-110' : 'group-hover:scale-110'}`} />
            Fahrer einladen
          </button>
          <button onClick={() => setActiveTab('profile')} className={`group px-4 py-3 font-semibold text-sm rounded-xl transition-all duration-300 flex items-center gap-2 ${activeTab === 'profile' ? 'text-white bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
            <User className={`w-5 h-5 transition-transform duration-300 ${activeTab === 'profile' ? 'scale-110' : 'group-hover:scale-110'}`} />
            Profil
          </button>
        </div>

        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Heutige Anwesenheit</h2>
                <button
                  onClick={loadAttendance}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Aktualisieren
                </button>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Fahrer suchen..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {attendanceLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-slate-600 dark:text-slate-400">Anwesenheit wird geladen...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAttendance.map((att) => (
                    <div
                      key={att.driver_id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        att.has_entry
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {att.has_entry ? (
                          <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        )}
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {att.driver_name}
                          </p>
                          {att.has_entry && att.last_entry && (
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Eingereicht um {new Date(att.last_entry).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        att.has_entry
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                      }`}>
                        {att.has_entry ? 'Eingereicht' : 'Nicht eingereicht'}
                      </span>
                    </div>
                  ))}

                  {filteredAttendance.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-slate-600 dark:text-slate-400">Keine Fahrer gefunden</p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <p className="text-sm text-green-700 dark:text-green-300 mb-1">Eingereicht</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {attendanceData.filter(a => a.has_entry).length}
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300 mb-1">Nicht eingereicht</p>
                    <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                      {attendanceData.filter(a => !a.has_entry).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'drivers' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Fahrer</h2>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Fahrer suchen..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-slate-600 dark:text-slate-400">Fahrer werden geladen...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">E-Mail</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">Führerschein</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDrivers.map((driver) => (
                        <tr key={driver.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          {editingDriver === driver.id ? (
                            <>
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  driver.is_active
                                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                                    : 'bg-gray-100 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300'
                                }`}>
                                  {driver.is_active ? 'Aktiv' : 'Inaktiv'}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={editFormData.driver_name}
                                  onChange={(e) => setEditFormData({ ...editFormData, driver_name: e.target.value })}
                                  className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded focus:ring-2 focus:ring-green-500"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="email"
                                  value={editFormData.email}
                                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                  className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded focus:ring-2 focus:ring-green-500"
                                  placeholder={driver.account_email ? undefined : 'Kein Konto'}
                                  disabled={!driver.account_id}
                                />
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex gap-1">
                                  <input
                                    type="text"
                                    value={editFormData.license_letters}
                                    onChange={(e) => setEditFormData({ ...editFormData, license_letters: e.target.value })}
                                    className="w-16 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded focus:ring-2 focus:ring-green-500"
                                    placeholder="ABC"
                                  />
                                  <input
                                    type="text"
                                    value={editFormData.license_numbers}
                                    onChange={(e) => setEditFormData({ ...editFormData, license_numbers: e.target.value })}
                                    className="w-20 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded focus:ring-2 focus:ring-green-500"
                                    placeholder="123456"
                                  />
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleSaveDriver(driver.id)}
                                    disabled={savingDriver}
                                    className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
                                    title="Speichern"
                                  >
                                    <Save className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    disabled={savingDriver}
                                    className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                                    title="Abbrechen"
                                  >
                                    <XIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  driver.is_active
                                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                                    : 'bg-gray-100 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300'
                                }`}>
                                  {driver.is_active ? 'Aktiv' : 'Inaktiv'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-900 dark:text-white font-medium">{driver.driver_name}</td>
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                {driver.account_email || '-'}
                              </td>
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                {driver.license_letters || driver.license_numbers
                                  ? `${driver.license_letters || ''} ${driver.license_numbers || ''}`.trim()
                                  : '-'}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleEditDriver(driver)}
                                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                    title="Fahrer bearbeiten"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  {hasPermission(user?.role || null, 'canManageDriverStatus') && (
                                    <button
                                      onClick={() => handleToggleDriverStatus(driver)}
                                      className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                      title={driver.is_active ? 'Fahrer deaktivieren' : 'Fahrer aktivieren'}
                                    >
                                      {driver.is_active ? (
                                        <PowerOff className="w-4 h-4" />
                                      ) : (
                                        <Power className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                  {hasPermission(user?.role || null, 'canDeleteDrivers') && (
                                    <button
                                      onClick={() => handleDeleteDriver(driver.id, driver.driver_name)}
                                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                      title="Fahrer löschen"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredDrivers.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-slate-600 dark:text-slate-400">Keine Fahrer gefunden</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'invites' && (
          <div className="space-y-6">
            <InviteManagement />
            <DirectAccountCreation />
          </div>
        )}

        {activeTab === 'profile' && (
          <SupervisorProfile />
        )}
      </main>
    </div>
  );
}
