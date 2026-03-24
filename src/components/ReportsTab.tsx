import { useState, useEffect } from 'react';
import { Calendar, Trash2, TrendingUp, Clock, Users as UsersIcon, Search, AlertCircle, BarChart3 } from 'lucide-react';
import { supabase, Driver, WorkEntry } from '../lib/supabase';
import { MonthSelector } from './MonthSelector';
import { calculateMonthStatistics, MonthStats } from '../lib/statisticsUtils';

interface WorkEntryWithDriver extends WorkEntry {
  driver_name: string;
}

interface DriverStats extends MonthStats {
  entries: WorkEntryWithDriver[];
}

type PeriodType = 'custom' | 'last_week' | 'last_month' | 'last_year' | 'month';

export function ReportsTab() {
  const [todayEntries, setTodayEntries] = useState<WorkEntryWithDriver[]>([]);
  const [loadingToday, setLoadingToday] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Driver Stats State
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);
  const [driverStats, setDriverStats] = useState<DriverStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Period filters
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  // Compare drivers
  const [driverA, setDriverA] = useState<Driver | null>(null);
  const [driverB, setDriverB] = useState<Driver | null>(null);
  const [compareYear, setCompareYear] = useState(new Date().getFullYear());
  const [compareMonth, setCompareMonth] = useState(new Date().getMonth() + 1);
  const [statsA, setStatsA] = useState<DriverStats | null>(null);
  const [statsB, setStatsB] = useState<DriverStats | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);

  useEffect(() => {
    loadTodayReports();
    loadDrivers();
  }, []);

  useEffect(() => {
    if (selectedDriver) {
      loadDriverStats();
    }
  }, [selectedDriver, periodType, customFrom, customTo, selectedYear, selectedMonth]);

  useEffect(() => {
    if (driverA && driverB) {
      loadCompareStats();
    }
  }, [driverA, driverB, compareYear, compareMonth]);

  const loadDrivers = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('is_active', true)
        .order('driver_name', { ascending: true });

      if (error) {
        console.error('Load drivers error:', error);
        return;
      }

      setDrivers(data || []);
    } catch (error) {
      console.error('Load drivers error:', error);
    }
  };

  const loadTodayReports = async () => {
    if (!supabase) {
      setMessage({ type: 'error', text: 'Datenbank nicht konfiguriert' });
      setLoadingToday(false);
      return;
    }

    setLoadingToday(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('work_entries')
        .select(`
          *,
          drivers:driver_id (
            driver_name
          )
        `)
        .eq('date', today)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Load today reports error:', error);
        setMessage({ type: 'error', text: 'Fehler beim Laden der Tagesberichte' });
        setLoadingToday(false);
        return;
      }

      const entriesWithDriver = (data || []).map(entry => ({
        ...entry,
        driver_name: (entry.drivers as any)?.driver_name || 'Unbekannt'
      }));

      setTodayEntries(entriesWithDriver);
    } catch (error: any) {
      console.error('Unexpected error:', error);
      setMessage({ type: 'error', text: 'Interner Fehler' });
    } finally {
      setLoadingToday(false);
    }
  };

  const deleteEntry = async (entryId: string, driverName: string) => {
    if (!supabase) return;

    if (!confirm(`Eintrag für ${driverName} wirklich löschen?`)) return;

    try {
      const { error } = await supabase
        .from('work_entries')
        .delete()
        .eq('id', entryId);

      if (error) {
        console.error('Delete entry error:', error);
        setMessage({ type: 'error', text: 'Fehler beim Löschen' });
        return;
      }

      setMessage({ type: 'success', text: 'Eintrag erfolgreich gelöscht' });
      loadTodayReports();
      if (selectedDriver) loadDriverStats();
      if (driverA && driverB) loadCompareStats();
    } catch (error: any) {
      console.error('Delete error:', error);
      setMessage({ type: 'error', text: 'Fehler beim Löschen' });
    }
  };

  const calculateWorkTime = (startTime: string, endTime: string): number => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);

    if (totalMinutes < 0) {
      totalMinutes += 24 * 60;
    }

    return totalMinutes / 60;
  };

  const formatHours = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  const getDateRange = (): { from: string; to: string } => {
    const today = new Date();
    let from: Date, to: Date;

    switch (periodType) {
      case 'last_week':
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(today.getDate() - today.getDay() - 7 + 1);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
        from = lastWeekStart;
        to = lastWeekEnd;
        break;

      case 'last_month':
        from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        to = new Date(today.getFullYear(), today.getMonth(), 0);
        break;

      case 'last_year':
        from = new Date(today.getFullYear() - 1, 0, 1);
        to = new Date(today.getFullYear() - 1, 11, 31);
        break;

      case 'month':
        from = new Date(selectedYear, selectedMonth - 1, 1);
        to = new Date(selectedYear, selectedMonth, 0);
        break;

      case 'custom':
        if (!customFrom || !customTo) {
          from = new Date(today.getFullYear(), today.getMonth(), 1);
          to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        } else {
          from = new Date(customFrom);
          to = new Date(customTo);
        }
        break;

      default:
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0]
    };
  };

  const loadDriverStats = async () => {
    if (!supabase || !selectedDriver) return;

    setLoadingStats(true);
    try {
      const { from, to } = getDateRange();

      const { data, error } = await supabase
        .from('work_entries')
        .select(`
          *,
          drivers:driver_id (
            driver_name
          )
        `)
        .eq('driver_id', selectedDriver.id)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false });

      if (error) {
        console.error('Load driver stats error:', error);
        setMessage({ type: 'error', text: 'Fehler beim Laden der Statistiken' });
        setLoadingStats(false);
        return;
      }

      const entriesWithDriver = (data || []).map(entry => ({
        ...entry,
        driver_name: (entry.drivers as any)?.driver_name || 'Unbekannt'
      }));

      const baseStats = calculateMonthStatistics(
        entriesWithDriver.map(e => ({
          date: e.date,
          start_time: e.start_time,
          end_time: e.end_time,
          break_minutes: e.break_minutes,
          vehicle: e.vehicle
        })),
        selectedYear,
        selectedMonth
      );

      const stats: DriverStats = {
        ...baseStats,
        entries: entriesWithDriver
      };

      setDriverStats(stats);
    } catch (error: any) {
      console.error('Unexpected error:', error);
      setMessage({ type: 'error', text: 'Interner Fehler' });
    } finally {
      setLoadingStats(false);
    }
  };

  const loadCompareStats = async () => {
    if (!supabase || !driverA || !driverB) return;

    setLoadingCompare(true);
    try {
      // Use the same date calculation method as DriverProfile for consistency
      const startDate = `${compareYear}-${String(compareMonth).padStart(2, '0')}-01`;
      const endDate = new Date(compareYear, compareMonth, 0);
      const endDateStr = `${compareYear}-${String(compareMonth).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

      const from = startDate;
      const to = endDateStr;

      // Query driver A entries
      const resultA = await supabase
        .from('work_entries')
        .select(`
          *,
          drivers:driver_id (
            driver_name
          )
        `)
        .eq('driver_id', driverA.id)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false });

      // Query driver B entries
      const resultB = await supabase
        .from('work_entries')
        .select(`
          *,
          drivers:driver_id (
            driver_name
          )
        `)
        .eq('driver_id', driverB.id)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false });

      if (resultA.error || resultB.error) {
        console.error('Load compare stats error:', resultA.error || resultB.error);
        setMessage({ type: 'error', text: 'Fehler beim Laden der Vergleichsdaten' });
        setLoadingCompare(false);
        return;
      }

      const processStats = (data: any[]): DriverStats => {
        const entriesWithDriver = data.map(entry => ({
          ...entry,
          driver_name: (entry.drivers as any)?.driver_name || 'Unbekannt'
        }));

        const baseStats = calculateMonthStatistics(
          entriesWithDriver.map(e => ({
            date: e.date,
            start_time: e.start_time,
            end_time: e.end_time,
            break_minutes: e.break_minutes,
            vehicle: e.vehicle
          })),
          compareYear,
          compareMonth
        );

        return {
          ...baseStats,
          entries: entriesWithDriver
        };
      };

      // Process stats for each driver independently
      setStatsA(processStats(resultA.data || []));
      setStatsB(processStats(resultB.data || []));
    } catch (error: any) {
      console.error('Unexpected error:', error);
      setMessage({ type: 'error', text: 'Interner Fehler' });
    } finally {
      setLoadingCompare(false);
    }
  };

  const filteredDrivers = drivers.filter(driver =>
    driver.driver_name.toLowerCase().includes(driverSearchQuery.toLowerCase())
  );

  const selectDriver = (driver: Driver) => {
    setSelectedDriver(driver);
    setDriverSearchQuery(driver.driver_name);
    setShowDriverDropdown(false);
    setDriverStats(null);
  };

  return (
    <div className="space-y-8 pb-8">
      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'error'
            ? 'bg-red-50 border border-red-200 text-red-800'
            : 'bg-green-50 border border-green-200 text-green-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Section 1: Tagesberichte (Heute) */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Tagesberichte (Heute)</h2>
        </div>

        {loadingToday ? (
          <p className="text-gray-500 text-center py-12">Lädt...</p>
        ) : todayEntries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Keine Einträge für heute vorhanden</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Fahrer Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Datum</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Von</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Bis</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Arbeitszeit</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Fahrzeug</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Notiz</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {todayEntries.map((entry) => {
                  const workHours = calculateWorkTime(entry.start_time, entry.end_time);
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{entry.driver_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{entry.date}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{entry.start_time}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{entry.end_time}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {formatHours(workHours)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{entry.vehicle || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {entry.notes || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteEntry(entry.id, entry.driver_name)}
                          className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"
                          title="Eintrag löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Fahrer-Statistiken */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-6 h-6 text-green-600" />
          <h2 className="text-2xl font-bold text-gray-900">Fahrer-Statistiken</h2>
        </div>

        {/* Driver Search */}
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">
            Fahrer suchen
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={driverSearchQuery}
              onChange={(e) => {
                setDriverSearchQuery(e.target.value);
                setShowDriverDropdown(true);
              }}
              onFocus={() => setShowDriverDropdown(true)}
              placeholder="Fahrer suchen..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            {showDriverDropdown && driverSearchQuery && filteredDrivers.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredDrivers.map((driver) => (
                  <button
                    key={driver.id}
                    onClick={() => selectDriver(driver)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <p className="font-medium text-gray-900">{driver.driver_name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedDriver && (
          <>
            {/* Period Selector */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-3">Zeitraum auswählen</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                <button
                  onClick={() => setPeriodType('last_week')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    periodType === 'last_week'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Letzte Woche
                </button>
                <button
                  onClick={() => setPeriodType('last_month')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    periodType === 'last_month'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Letzter Monat
                </button>
                <button
                  onClick={() => setPeriodType('last_year')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    periodType === 'last_year'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Letztes Jahr
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Month Picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Monat</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedYear}
                      onChange={(e) => {
                        setSelectedYear(Number(e.target.value));
                        setPeriodType('month');
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                    <select
                      value={selectedMonth}
                      onChange={(e) => {
                        setSelectedMonth(Number(e.target.value));
                        setPeriodType('month');
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                        <option key={month} value={month}>
                          {new Date(2000, month - 1).toLocaleString('de-DE', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Custom Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Benutzerdefiniert</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => {
                        setCustomFrom(e.target.value);
                        if (e.target.value && customTo) setPeriodType('custom');
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Von"
                    />
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => {
                        setCustomTo(e.target.value);
                        if (customFrom && e.target.value) setPeriodType('custom');
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Bis"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Display */}
            {loadingStats ? (
              <p className="text-gray-500 text-center py-12">Lädt Statistiken...</p>
            ) : driverStats ? (
              <>
                <div className="mb-6">
                  <MonthSelector
                    selectedYear={selectedYear}
                    selectedMonth={selectedMonth}
                    onMonthChange={(year, month) => {
                      setSelectedYear(year);
                      setSelectedMonth(month);
                      setPeriodType('month');
                    }}
                    variant="admin"
                  />
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <p className="text-sm text-blue-600 font-medium">Arbeitstage</p>
                    </div>
                    <p className="text-3xl font-bold text-blue-900">{driverStats.arbeitstage}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-green-600" />
                      <p className="text-sm text-green-600 font-medium">Gesamtstunden</p>
                    </div>
                    <p className="text-3xl font-bold text-green-900">
                      {formatHours(driverStats.gesamtstunden)}
                    </p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-orange-600" />
                      <p className="text-sm text-orange-600 font-medium">Durchschnitt</p>
                    </div>
                    <p className="text-3xl font-bold text-orange-900">
                      {formatHours(driverStats.durchschnitt)}
                    </p>
                  </div>
                  <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-5 h-5 text-cyan-600" />
                      <p className="text-sm text-cyan-600 font-medium">Einträge</p>
                    </div>
                    <p className="text-3xl font-bold text-cyan-900">{driverStats.entries.length}</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <p className="text-sm text-red-600 font-medium">Fehlende Tage</p>
                    </div>
                    <p className="text-3xl font-bold text-red-900">{driverStats.fehlendeTage}</p>
                    <p className="text-xs text-red-600 mt-1 truncate">
                      {driverStats.fehlendeTageList.length > 0 ? driverStats.fehlendeTageList.join(', ') : '-'}
                    </p>
                  </div>
                </div>

                {/* Detailed List */}
                {driverStats.entries.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Datum</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Von</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Bis</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Arbeitszeit</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Fahrzeug</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Notiz</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {driverStats.entries.map((entry) => {
                          const workHours = calculateWorkTime(entry.start_time, entry.end_time);
                          return (
                            <tr key={entry.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">{entry.date}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{entry.start_time}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{entry.end_time}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                {formatHours(workHours)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{entry.vehicle || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                                {entry.notes || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">Keine Einträge im ausgewählten Zeitraum</p>
                )}
              </>
            ) : null}
          </>
        )}
      </div>

      {/* Section 3: Fahrer vergleichen */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <UsersIcon className="w-6 h-6 text-purple-600" />
          <h2 className="text-2xl font-bold text-gray-900">Fahrer vergleichen</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Driver A */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">Fahrer A</label>
            <select
              value={driverA?.id || ''}
              onChange={(e) => {
                const driver = drivers.find(d => d.id === e.target.value);
                setDriverA(driver || null);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Fahrer auswählen...</option>
              {drivers.map(driver => (
                <option key={driver.id} value={driver.id}>
                  {driver.driver_name}
                </option>
              ))}
            </select>
          </div>

          {/* Driver B */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">Fahrer B</label>
            <select
              value={driverB?.id || ''}
              onChange={(e) => {
                const driver = drivers.find(d => d.id === e.target.value);
                setDriverB(driver || null);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Fahrer auswählen...</option>
              {drivers.map(driver => (
                <option key={driver.id} value={driver.id}>
                  {driver.driver_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Month Selector for Comparison */}
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">Monat</label>
          <div className="flex gap-2">
            <select
              value={compareYear}
              onChange={(e) => setCompareYear(Number(e.target.value))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              value={compareMonth}
              onChange={(e) => setCompareMonth(Number(e.target.value))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>
                  {new Date(2000, month - 1).toLocaleString('de-DE', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Comparison Results */}
        {loadingCompare ? (
          <p className="text-gray-500 text-center py-12">Lädt Vergleich...</p>
        ) : driverA && driverB && statsA && statsB ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Driver A Stats */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-bold text-lg text-gray-900 mb-4">
                {driverA.driver_name}
              </h3>
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-sm text-blue-600 font-medium">Arbeitstage</p>
                  <p className="text-2xl font-bold text-blue-900">{statsA.arbeitstage}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <p className="text-sm text-green-600 font-medium">Gesamtstunden</p>
                  <p className="text-2xl font-bold text-green-900">
                    {formatHours(statsA.gesamtstunden)}
                  </p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded p-3">
                  <p className="text-sm text-orange-600 font-medium">Durchschnitt pro Tag</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {formatHours(statsA.durchschnitt)}
                  </p>
                </div>
                <div className="bg-cyan-50 border border-cyan-200 rounded p-3">
                  <p className="text-sm text-cyan-600 font-medium">Einträge</p>
                  <p className="text-2xl font-bold text-cyan-900">{statsA.entries.length}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-sm text-red-600 font-medium">Fehlende Tage</p>
                  <p className="text-2xl font-bold text-red-900">{statsA.fehlendeTage}</p>
                  <p className="text-xs text-red-600 mt-1 break-words">
                    {statsA.fehlendeTageList.length > 0 ? statsA.fehlendeTageList.join(', ') : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Driver B Stats */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-bold text-lg text-gray-900 mb-4">
                {driverB.driver_name}
              </h3>
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-sm text-blue-600 font-medium">Arbeitstage</p>
                  <p className="text-2xl font-bold text-blue-900">{statsB.arbeitstage}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <p className="text-sm text-green-600 font-medium">Gesamtstunden</p>
                  <p className="text-2xl font-bold text-green-900">
                    {formatHours(statsB.gesamtstunden)}
                  </p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded p-3">
                  <p className="text-sm text-orange-600 font-medium">Durchschnitt pro Tag</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {formatHours(statsB.durchschnitt)}
                  </p>
                </div>
                <div className="bg-cyan-50 border border-cyan-200 rounded p-3">
                  <p className="text-sm text-cyan-600 font-medium">Einträge</p>
                  <p className="text-2xl font-bold text-cyan-900">{statsB.entries.length}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-sm text-red-600 font-medium">Fehlende Tage</p>
                  <p className="text-2xl font-bold text-red-900">{statsB.fehlendeTage}</p>
                  <p className="text-xs text-red-600 mt-1 break-words">
                    {statsB.fehlendeTageList.length > 0 ? statsB.fehlendeTageList.join(', ') : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : driverA && driverB ? (
          <p className="text-gray-500 text-center py-8">Keine Daten verfügbar</p>
        ) : (
          <p className="text-gray-500 text-center py-8">
            Bitte wählen Sie zwei Fahrer zum Vergleichen aus
          </p>
        )}
      </div>
    </div>
  );
}
