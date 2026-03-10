import { useState, useEffect } from 'react';
import {
  Users,
  LogOut,
  UserPlus,
  Trash2,
  Key,
  CheckCircle2,
  XCircle,
  Search,
  Moon,
  Sun,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDarkMode } from '../hooks/useDarkMode';
import { supabase, Driver } from '../lib/supabase';
import { InviteManagement } from './InviteManagement';

type Tab = 'drivers' | 'attendance' | 'invites';

export function SupervisorDashboard() {
  const { user, logout } = useAuth();
  const [isDarkMode, setIsDarkMode] = useDarkMode();
  const [activeTab, setActiveTab] = useState<Tab>('attendance');

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [newDriver, setNewDriver] = useState({
    code: '',
    name: '',
    license_letters: '',
    license_numbers: ''
  });
  const [addingDriver, setAddingDriver] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [attendanceData, setAttendanceData] = useState<{
    driver_id: string;
    driver_code: string;
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
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('is_active', true)
      .order('driver_name');

    if (!error && data) {
      setDrivers(data);
    }
    setLoading(false);
  };

  const loadAttendance = async () => {
    if (!supabase) return;

    setAttendanceLoading(true);

    const today = new Date().toISOString().split('T')[0];

    const { data: driversData, error: driversError } = await supabase
      .from('drivers')
      .select('id, driver_code, driver_name')
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
      driver_code: driver.driver_code,
      driver_name: driver.driver_name,
      has_entry: attendanceMap.has(driver.id),
      last_entry: attendanceMap.get(driver.id)
    }));

    setAttendanceData(attendance);
    setAttendanceLoading(false);
  };

  const handleAddDriver = async () => {
    if (!supabase) return;

    if (!newDriver.code || !newDriver.name) {
      setMessage({ type: 'error', text: 'Driver code and name are required' });
      return;
    }

    setAddingDriver(true);
    setMessage(null);

    const { error } = await supabase
      .from('drivers')
      .insert({
        driver_code: newDriver.code,
        driver_name: newDriver.name,
        license_letters: newDriver.license_letters || null,
        license_numbers: newDriver.license_numbers || null,
        is_active: true
      });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Driver added successfully' });
      setNewDriver({ code: '', name: '', license_letters: '', license_numbers: '' });
      setShowAddForm(false);
      await loadDrivers();
      await loadAttendance();
    }

    setAddingDriver(false);
  };

  const handleDeleteDriver = async (driverId: string, driverName: string) => {
    if (!supabase) return;

    if (!confirm(`Are you sure you want to deactivate ${driverName}?`)) {
      return;
    }

    const { error } = await supabase
      .from('drivers')
      .update({ is_active: false })
      .eq('id', driverId);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Driver deactivated successfully' });
      await loadDrivers();
      await loadAttendance();
    }
  };

  const handleResetPassword = async (driverId: string, driverCode: string) => {
    if (!supabase) return;

    const newPassword = prompt(`Enter new password for driver ${driverCode}:`);
    if (!newPassword) return;

    const { error } = await supabase
      .from('drivers')
      .update({
        driver_code: driverCode
      })
      .eq('id', driverId);

    if (error) {
      setMessage({ type: 'error', text: 'Password reset not available in current setup' });
    } else {
      setMessage({ type: 'success', text: `Password updated for ${driverCode}` });
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const filteredDrivers = drivers.filter(driver =>
    driver.driver_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    driver.driver_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAttendance = attendanceData.filter(att =>
    att.driver_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    att.driver_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user || user.role !== 'supervisor') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Supervisor Dashboard</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">{user.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
          }`}>
            {message.text}
          </div>
        )}

        <div className="mb-6 flex gap-4 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`pb-3 px-1 font-medium transition-colors relative ${
              activeTab === 'attendance'
                ? 'text-green-600 dark:text-green-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Attendance Tracking
            </span>
            {activeTab === 'attendance' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600 dark:bg-green-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            className={`pb-3 px-1 font-medium transition-colors relative ${
              activeTab === 'drivers'
                ? 'text-green-600 dark:text-green-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Manage Drivers
            </span>
            {activeTab === 'drivers' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600 dark:bg-green-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={`pb-3 px-1 font-medium transition-colors relative ${
              activeTab === 'invites'
                ? 'text-green-600 dark:text-green-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Invite Drivers
            </span>
            {activeTab === 'invites' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600 dark:bg-green-400" />
            )}
          </button>
        </div>

        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Today's Attendance</h2>
                <button
                  onClick={loadAttendance}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Refresh
                </button>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search drivers..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {attendanceLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-slate-600 dark:text-slate-400">Loading attendance...</p>
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
                            {att.driver_code} - {att.driver_name}
                          </p>
                          {att.has_entry && att.last_entry && (
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Submitted at {new Date(att.last_entry).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        att.has_entry
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                      }`}>
                        {att.has_entry ? 'Submitted' : 'Not Submitted'}
                      </span>
                    </div>
                  ))}

                  {filteredAttendance.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-slate-600 dark:text-slate-400">No drivers found</p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <p className="text-sm text-green-700 dark:text-green-300 mb-1">Submitted</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {attendanceData.filter(a => a.has_entry).length}
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300 mb-1">Not Submitted</p>
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
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Manage Drivers</h2>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <UserPlus className="w-5 h-5" />
                  Add Driver
                </button>
              </div>

              {showAddForm && (
                <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Add New Driver</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Driver Code *
                      </label>
                      <input
                        type="text"
                        value={newDriver.code}
                        onChange={(e) => setNewDriver({ ...newDriver, code: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="e.g., DRV001"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Driver Name *
                      </label>
                      <input
                        type="text"
                        value={newDriver.name}
                        onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="e.g., John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        License Letters
                      </label>
                      <input
                        type="text"
                        value={newDriver.license_letters}
                        onChange={(e) => setNewDriver({ ...newDriver, license_letters: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        License Numbers
                      </label>
                      <input
                        type="text"
                        value={newDriver.license_numbers}
                        onChange={(e) => setNewDriver({ ...newDriver, license_numbers: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleAddDriver}
                      disabled={addingDriver}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {addingDriver ? 'Adding...' : 'Add Driver'}
                    </button>
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-900 dark:text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search drivers..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-slate-600 dark:text-slate-400">Loading drivers...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">Code</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">License</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDrivers.map((driver) => (
                        <tr key={driver.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="py-3 px-4 text-slate-900 dark:text-white font-medium">{driver.driver_code}</td>
                          <td className="py-3 px-4 text-slate-900 dark:text-white">{driver.driver_name}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {driver.license_letters || driver.license_numbers
                              ? `${driver.license_letters || ''} ${driver.license_numbers || ''}`.trim()
                              : '-'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleResetPassword(driver.id, driver.driver_code)}
                                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                title="Reset Password"
                              >
                                <Key className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteDriver(driver.id, driver.driver_name)}
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Deactivate Driver"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredDrivers.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-slate-600 dark:text-slate-400">No drivers found</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'invites' && (
          <InviteManagement />
        )}
      </main>
    </div>
  );
}
