import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, Driver, WorkEntry } from '../lib/supabase';
import {
  Users, FileText, BarChart3, Plus, Pencil, Trash2,
  Check, X, Search, Download, LogOut,
  Power, PowerOff, Filter, RefreshCw, FileSpreadsheet, Settings, Clock, Moon, Sun, Loader2
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useDarkMode } from '../hooks/useDarkMode';
import { useDebounce } from '../hooks/useDebounce';

interface Message {
  type: 'success' | 'error';
  text: string;
}

type TabType = 'dashboard' | 'reports' | 'entries' | 'drivers' | 'settings';

interface DashboardStats {
  driversSubmittedToday: number;
  driversNotSubmittedToday: Driver[];
  totalHoursToday: number;
  overtimeToday: number;
}

interface ReportSummary {
  arbeitstage: number;
  gesamtarbeitszeit: string;
  uberstunden: string;
  totalHours: number;
  overtimeHours: number;
}

type PeriodType = 'diese_woche' | 'letzte_woche' | 'dieser_monat' | 'letzter_monat' | 'dieses_jahr' | 'letztes_jahr';

const STANDARD_HOURS = 9;

export default function AdminDashboardV2({ onLogout }: { onLogout: () => void }) {
  const { isDark, toggleDarkMode } = useDarkMode();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [message, setMessage] = useState<Message | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const debouncedSearch = useDebounce(searchText, 400);
  const [searchResults, setSearchResults] = useState<Driver[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchAbortControllerRef = useRef<AbortController | null>(null);

  const [newDriverCode, setNewDriverCode] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterDriverId, setFilterDriverId] = useState('');
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('dieser_monat');
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [reportEntries, setReportEntries] = useState<WorkEntry[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (activeTab === 'dashboard') loadDashboardStats();
    if (activeTab === 'drivers') loadDrivers();
    if (activeTab === 'entries') loadEntries();
  }, [activeTab]);

  useEffect(() => {
    if (debouncedSearch.length > 0) {
      searchDrivers(debouncedSearch);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  }, [debouncedSearch]);

  const searchDrivers = async (query: string) => {
    if (!supabase) return;

    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    searchAbortControllerRef.current = abortController;

    setLoadingSearch(true);

    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .or(`driver_code.ilike.%${query}%,driver_name.ilike.%${query}%`)
        .eq('is_active', true)
        .limit(15);

      if (abortController.signal.aborted) return;

      if (error) throw error;

      setSearchResults(data || []);
      setShowSearchResults(true);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Search error:', error);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoadingSearch(false);
      }
    }
  };

  const handleSelectDriver = (driver: Driver) => {
    setSelectedDriver(driver);
    setSearchText(driver.driver_name || driver.driver_code);
    setShowSearchResults(false);
    setFilterDriverId(driver.id);
  };

  const handleClearDriver = () => {
    setSelectedDriver(null);
    setSearchText('');
    setFilterDriverId('');
    setShowSearchResults(false);
  };

  const loadDashboardStats = async () => {
    if (!supabase) return;
    setLoadingDashboard(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      const { data: allDrivers } = await supabase
        .from('drivers')
        .select('*')
        .eq('is_active', true);

      const { data: todayEntriesData } = await supabase
        .from('work_entries')
        .select('*, drivers(*)')
        .eq('date', today);

      if (allDrivers && todayEntriesData) {
        const submittedDriverIds = new Set(todayEntriesData.map(e => e.driver_id));
        const driversNotSubmitted = allDrivers.filter(d => !submittedDriverIds.has(d.id));

        let totalHours = 0;
        let totalOvertime = 0;

        todayEntriesData.forEach(entry => {
          const hours = calculateDuration(entry.start_time, entry.end_time);
          totalHours += hours;
          const overtime = Math.max(0, hours - STANDARD_HOURS);
          totalOvertime += overtime;
        });

        setDashboardStats({
          driversSubmittedToday: submittedDriverIds.size,
          driversNotSubmittedToday: driversNotSubmitted,
          totalHoursToday: totalHours,
          overtimeToday: totalOvertime
        });
      }
    } catch (error) {
      console.error('Dashboard stats error:', error);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const calculateDuration = (from: string, to: string): number => {
    const [fromH, fromM] = from.split(':').map(Number);
    const [toH, toM] = to.split(':').map(Number);
    const fromMinutes = fromH * 60 + fromM;
    const toMinutes = toH * 60 + toM;
    return (toMinutes - fromMinutes) / 60;
  };

  const formatHours = (hours: number): string => {
    if (hours === 0) return '0';
    const formatted = hours.toFixed(2).replace(/\.?0+$/, '');
    return formatted;
  };

  const loadDrivers = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('Error loading drivers:', error);
      setMessage({ type: 'error', text: 'Fehler beim Laden der Fahrer' });
    }
  };

  const handleAddDriver = async () => {
    if (!supabase) return;
    if (!newDriverCode.trim() || !newDriverName.trim()) {
      setMessage({ type: 'error', text: 'Bitte Fahrercode und Namen eingeben' });
      return;
    }

    try {
      const { error } = await supabase
        .from('drivers')
        .insert({
          driver_code: newDriverCode.trim().toUpperCase(),
          driver_name: newDriverName.trim(),
          is_active: true
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Fahrer erfolgreich hinzugefügt' });
      setNewDriverCode('');
      setNewDriverName('');
      loadDrivers();
    } catch (error: any) {
      console.error('Error adding driver:', error);
      if (error.code === '23505') {
        setMessage({ type: 'error', text: 'Dieser Fahrercode existiert bereits' });
      } else {
        setMessage({ type: 'error', text: 'Fehler beim Hinzufügen des Fahrers' });
      }
    }
  };

  const handleToggleDriverStatus = async (driver: Driver) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .update({ is_active: !driver.is_active })
        .eq('id', driver.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Status erfolgreich aktualisiert' });
      loadDrivers();
    } catch (error) {
      console.error('Error toggling driver status:', error);
      setMessage({ type: 'error', text: 'Fehler beim Aktualisieren des Status' });
    }
  };

  const handleUpdateDriver = async (driver: Driver) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .update({
          driver_code: driver.driver_code.trim().toUpperCase(),
          driver_name: driver.driver_name.trim()
        })
        .eq('id', driver.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Fahrer erfolgreich aktualisiert' });
      setEditingDriver(null);
      loadDrivers();
    } catch (error: any) {
      console.error('Error updating driver:', error);
      if (error.code === '23505') {
        setMessage({ type: 'error', text: 'Dieser Fahrercode existiert bereits' });
      } else {
        setMessage({ type: 'error', text: 'Fehler beim Aktualisieren des Fahrers' });
      }
    }
  };

  const loadEntries = async () => {
    if (!supabase) return;

    try {
      let query = supabase
        .from('work_entries')
        .select('*, drivers(driver_code, driver_name)');

      if (filterDateFrom) {
        query = query.gte('date', filterDateFrom);
      }
      if (filterDateTo) {
        query = query.lte('date', filterDateTo);
      }
      if (filterDriverId) {
        query = query.eq('driver_id', filterDriverId);
      }

      const { data, error } = await query.order('date', { ascending: false }).limit(200);

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error loading entries:', error);
      setMessage({ type: 'error', text: 'Fehler beim Laden der Einträge' });
    }
  };

  const toggleSelectEntry = (id: string) => {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEntries(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedEntries.size === entries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(entries.map(e => e.id)));
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!supabase) return;
    if (!confirm('Eintrag wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('work_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Eintrag gelöscht' });
      loadEntries();
      if (activeTab === 'dashboard') loadDashboardStats();
    } catch (error) {
      console.error('Error deleting entry:', error);
      setMessage({ type: 'error', text: 'Fehler beim Löschen' });
    }
  };

  const handleBulkDelete = async () => {
    if (!supabase) return;
    if (selectedEntries.size === 0) {
      setMessage({ type: 'error', text: 'Keine Einträge ausgewählt' });
      return;
    }

    if (!confirm(`${selectedEntries.size} Einträge wirklich löschen?`)) return;

    try {
      const deletePromises = Array.from(selectedEntries).map(id =>
        supabase.from('work_entries').delete().eq('id', id)
      );

      const results = await Promise.all(deletePromises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        setMessage({ type: 'error', text: `Fehler beim Löschen von ${errors.length} Einträgen` });
      } else {
        setMessage({ type: 'success', text: `${selectedEntries.size} Einträge gelöscht` });
        setSelectedEntries(new Set());
        loadEntries();
        if (activeTab === 'dashboard') loadDashboardStats();
      }
    } catch (error) {
      console.error('Error bulk deleting:', error);
      setMessage({ type: 'error', text: 'Fehler beim Löschen' });
    }
  };

  const getDateRangeForPeriod = (period: PeriodType): { from: string; to: string } => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDay();

    let from: Date;
    let to: Date;

    switch (period) {
      case 'diese_woche':
        from = new Date(now);
        from.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
        to = new Date(from);
        to.setDate(from.getDate() + 6);
        break;

      case 'letzte_woche':
        from = new Date(now);
        from.setDate(now.getDate() - day + (day === 0 ? -6 : 1) - 7);
        to = new Date(from);
        to.setDate(from.getDate() + 6);
        break;

      case 'dieser_monat':
        from = new Date(year, month, 1);
        to = new Date(year, month + 1, 0);
        break;

      case 'letzter_monat':
        from = new Date(year, month - 1, 1);
        to = new Date(year, month, 0);
        break;

      case 'dieses_jahr':
        from = new Date(year, 0, 1);
        to = new Date(year, 11, 31);
        break;

      case 'letztes_jahr':
        from = new Date(year - 1, 0, 1);
        to = new Date(year - 1, 11, 31);
        break;
    }

    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0]
    };
  };

  const generateReport = async () => {
    if (!supabase) return;

    if (!selectedDriver) {
      setMessage({ type: 'error', text: 'Bitte wählen Sie einen Fahrer aus' });
      return;
    }

    setLoadingReport(true);

    try {
      const { from, to } = getDateRangeForPeriod(selectedPeriod);

      const { data, error } = await supabase
        .from('work_entries')
        .select('*')
        .eq('driver_id', selectedDriver.id)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true });

      if (error) throw error;

      let totalHours = 0;
      let totalOvertime = 0;
      const arbeitstage = data?.length || 0;

      data?.forEach(entry => {
        const hours = calculateDuration(entry.start_time, entry.end_time);
        totalHours += hours;
        const overtime = Math.max(0, hours - STANDARD_HOURS);
        totalOvertime += overtime;
      });

      setReportSummary({
        arbeitstage,
        gesamtarbeitszeit: `${formatHours(totalHours)} Stunden`,
        uberstunden: `${formatHours(totalOvertime)} Stunden`,
        totalHours,
        overtimeHours: totalOvertime
      });

      setReportEntries(data || []);
    } catch (error) {
      console.error('Error generating report:', error);
      setMessage({ type: 'error', text: 'Fehler beim Erstellen des Berichts' });
    } finally {
      setLoadingReport(false);
    }
  };

  const exportReportPDF = () => {
    if (!selectedDriver || !reportSummary) return;

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Arbeitszeitbericht', 14, 20);

    doc.setFontSize(12);
    doc.text(`Fahrer: ${selectedDriver.driver_name} (${selectedDriver.driver_code})`, 14, 30);
    doc.text(`Zeitraum: ${selectedPeriod.replace('_', ' ')}`, 14, 37);
    doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 14, 44);

    doc.setFontSize(10);
    doc.text(`Arbeitstage: ${reportSummary.arbeitstage}`, 14, 55);
    doc.text(`Gesamtarbeitszeit: ${reportSummary.gesamtarbeitszeit}`, 14, 62);
    doc.text(`Überstunden: ${reportSummary.uberstunden}`, 14, 69);

    if (reportEntries.length > 0) {
      const tableData = reportEntries.map(entry => {
        const hours = calculateDuration(entry.start_time, entry.end_time);
        const overtime = Math.max(0, hours - STANDARD_HOURS);

        return [
          entry.date,
          entry.vehicle || '-',
          entry.start_time,
          entry.end_time,
          formatHours(hours),
          formatHours(overtime),
          entry.notes || '-'
        ];
      });

      autoTable(doc, {
        head: [['Datum', 'Fahrzeug', 'Von', 'Bis', 'Stunden', 'Überstunden', 'Notiz']],
        body: tableData,
        startY: 75,
        styles: { fontSize: 9 }
      });
    }

    doc.save(`Bericht_${selectedDriver.driver_code}_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.pdf`);
    setMessage({ type: 'success', text: 'PDF erfolgreich exportiert' });
  };

  const exportReportExcel = () => {
    if (!selectedDriver || !reportSummary) return;

    const excelData = reportEntries.map(entry => {
      const hours = calculateDuration(entry.start_time, entry.end_time);
      const overtime = Math.max(0, hours - STANDARD_HOURS);

      return {
        'Datum': entry.date,
        'Fahrzeug': entry.vehicle || '-',
        'Von': entry.start_time,
        'Bis': entry.end_time,
        'Arbeitszeit': formatHours(hours),
        'Überstunden': formatHours(overtime),
        'Notiz': entry.notes || '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bericht');
    XLSX.writeFile(wb, `Bericht_${selectedDriver.driver_code}_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.xlsx`);
    setMessage({ type: 'success', text: 'Excel erfolgreich exportiert' });
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 dark:bg-slate-950 flex flex-col">
      <header className="card m-0 rounded-none border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex-shrink-0">
              <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                Admin Dashboard
              </h1>
              <p className="text-xs text-gray-500 dark:text-slate-400 hidden sm:block">
                Trans Oflex Verwaltung
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={toggleDarkMode}
              className="btn-icon"
              title={isDark ? 'Helles Design' : 'Dunkles Design'}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={onLogout}
              className="btn-secondary flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {message && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 mt-4">
          <div className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-green-900 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
          }`}>
            {message.text}
          </div>
        </div>
      )}

      <nav className="card m-0 rounded-none border-b sticky top-16 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6">
          <div className="flex space-x-1 overflow-x-auto scrollbar-hide">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'reports', label: 'Berichte', icon: FileText },
              { id: 'entries', label: 'Einträge', icon: Clock },
              { id: 'drivers', label: 'Fahrer', icon: Users },
              { id: 'settings', label: 'Einstellungen', icon: Settings }
            ].map(tab => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {loadingDashboard ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : dashboardStats ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="card p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-600 dark:text-slate-400">
                        Eingetragen heute
                      </h3>
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                        <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {dashboardStats.driversSubmittedToday}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Fahrer
                    </p>
                  </div>

                  <div className="card p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-600 dark:text-slate-400">
                        Nicht eingetragen
                      </h3>
                      <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                        <X className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {dashboardStats.driversNotSubmittedToday.length}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Fahrer
                    </p>
                  </div>

                  <div className="card p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-600 dark:text-slate-400">
                        Gesamtstunden
                      </h3>
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                        <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {formatHours(dashboardStats.totalHoursToday)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Stunden heute
                    </p>
                  </div>

                  <div className="card p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-600 dark:text-slate-400">
                        Überstunden
                      </h3>
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                        <Plus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {formatHours(dashboardStats.overtimeToday)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Stunden heute
                    </p>
                  </div>
                </div>

                {dashboardStats.driversNotSubmittedToday.length > 0 && (
                  <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Fahrer ohne Eintrag heute ({dashboardStats.driversNotSubmittedToday.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {dashboardStats.driversNotSubmittedToday.map(driver => (
                        <div key={driver.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                          <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Users className="w-5 h-5 text-gray-600 dark:text-slate-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {driver.driver_name || 'Unbekannt'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                              {driver.driver_code}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Bericht erstellen
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="label-text">
                    Fahrer suchen
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchText}
                      onChange={(e) => {
                        setSearchText(e.target.value);
                        if (e.target.value === '') {
                          handleClearDriver();
                        }
                      }}
                      onFocus={() => {
                        if (searchText && searchResults.length > 0) {
                          setShowSearchResults(true);
                        }
                      }}
                      placeholder="Fahrercode oder Name eingeben..."
                      className="input-field pr-10"
                      disabled={loadingReport}
                    />
                    {loadingSearch && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      </div>
                    )}
                    {showSearchResults && searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 card max-h-64 overflow-y-auto z-20">
                        {searchResults.map(driver => (
                          <button
                            key={driver.id}
                            onClick={() => handleSelectDriver(driver)}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 border-b border-gray-200 dark:border-slate-700 last:border-b-0 transition-colors"
                          >
                            <div className="font-medium text-gray-900 dark:text-white">
                              {driver.driver_name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-slate-400">
                              {driver.driver_code}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedDriver && (
                    <div className="mt-2 flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {selectedDriver.driver_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {selectedDriver.driver_code}
                        </p>
                      </div>
                      <button
                        onClick={handleClearDriver}
                        className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="label-text">
                    Zeitraum
                  </label>
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value as PeriodType)}
                    className="input-field"
                    disabled={loadingReport}
                  >
                    <option value="diese_woche">Diese Woche</option>
                    <option value="letzte_woche">Letzte Woche</option>
                    <option value="dieser_monat">Dieser Monat</option>
                    <option value="letzter_monat">Letzter Monat</option>
                    <option value="dieses_jahr">Dieses Jahr</option>
                    <option value="letztes_jahr">Letztes Jahr</option>
                  </select>
                </div>

                <button
                  onClick={generateReport}
                  disabled={!selectedDriver || loadingReport}
                  className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2"
                >
                  {loadingReport ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Wird erstellt...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Bericht erstellen
                    </>
                  )}
                </button>
              </div>
            </div>

            {reportSummary && (
              <>
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Zusammenfassung
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={exportReportPDF}
                        className="btn-secondary text-sm flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">PDF</span>
                      </button>
                      <button
                        onClick={exportReportExcel}
                        className="btn-secondary text-sm flex items-center gap-2"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span className="hidden sm:inline">Excel</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-slate-400">Arbeitstage</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {reportSummary.arbeitstage}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-slate-400">Gesamtarbeitszeit</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {reportSummary.gesamtarbeitszeit}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-slate-400">Überstunden</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {reportSummary.uberstunden}
                      </p>
                    </div>
                  </div>
                </div>

                {reportEntries.length > 0 && (
                  <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Einträge ({reportEntries.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-slate-700">
                            <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Datum</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Fahrzeug</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Von</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Bis</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Stunden</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Überstunden</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportEntries.map(entry => {
                            const hours = calculateDuration(entry.start_time, entry.end_time);
                            const overtime = Math.max(0, hours - STANDARD_HOURS);
                            return (
                              <tr key={entry.id} className="border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                <td className="py-3 px-4">{entry.date}</td>
                                <td className="py-3 px-4">{entry.vehicle || '-'}</td>
                                <td className="py-3 px-4">{entry.start_time}</td>
                                <td className="py-3 px-4">{entry.end_time}</td>
                                <td className="py-3 px-4">{formatHours(hours)}h</td>
                                <td className="py-3 px-4">{formatHours(overtime)}h</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'entries' && (
          <div className="space-y-4">
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Einträge filtern
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="label-text">Von Datum</label>
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">Bis Datum</label>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">Fahrer</label>
                  <select
                    value={filterDriverId}
                    onChange={(e) => setFilterDriverId(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Alle Fahrer</option>
                    {drivers.filter(d => d.is_active).map(driver => (
                      <option key={driver.id} value={driver.id}>
                        {driver.driver_name} ({driver.driver_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={loadEntries}
                className="btn-primary flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Filtern
              </button>
            </div>

            {selectedEntries.size > 0 && (
              <div className="card p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedEntries.size} ausgewählt
                </span>
                <button
                  onClick={handleBulkDelete}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Löschen
                </button>
              </div>
            )}

            <div className="card p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={selectedEntries.size === entries.length && entries.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded"
                        />
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Datum</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Fahrer</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Fahrzeug</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Von-Bis</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Stunden</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(entry => {
                      const hours = calculateDuration(entry.start_time, entry.end_time);
                      return (
                        <tr key={entry.id} className="border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={selectedEntries.has(entry.id)}
                              onChange={() => toggleSelectEntry(entry.id)}
                              className="rounded"
                            />
                          </td>
                          <td className="py-3 px-4">{entry.date}</td>
                          <td className="py-3 px-4">
                            {(entry as any).drivers?.driver_name || '-'}
                          </td>
                          <td className="py-3 px-4">{entry.vehicle || '-'}</td>
                          <td className="py-3 px-4">
                            {entry.start_time} - {entry.end_time}
                          </td>
                          <td className="py-3 px-4">{formatHours(hours)}h</td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Löschen"
                            >
                              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {entries.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                    Keine Einträge gefunden
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'drivers' && (
          <div className="space-y-4">
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Neuen Fahrer hinzufügen
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  value={newDriverCode}
                  onChange={(e) => setNewDriverCode(e.target.value.toUpperCase())}
                  placeholder="Fahrercode (z.B. DRV001)"
                  className="input-field"
                />
                <input
                  type="text"
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  placeholder="Fahrername"
                  className="input-field"
                />
              </div>
              <button
                onClick={handleAddDriver}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Hinzufügen
              </button>
            </div>

            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Fahrerliste ({drivers.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Code</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map(driver => (
                      <tr key={driver.id} className="border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4">
                          {editingDriver?.id === driver.id ? (
                            <input
                              type="text"
                              value={editingDriver.driver_code}
                              onChange={(e) => setEditingDriver({
                                ...editingDriver,
                                driver_code: e.target.value.toUpperCase()
                              })}
                              className="input-field py-1 text-sm"
                            />
                          ) : (
                            driver.driver_code
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {editingDriver?.id === driver.id ? (
                            <input
                              type="text"
                              value={editingDriver.driver_name}
                              onChange={(e) => setEditingDriver({
                                ...editingDriver,
                                driver_name: e.target.value
                              })}
                              className="input-field py-1 text-sm"
                            />
                          ) : (
                            driver.driver_name
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            driver.is_active
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-slate-300'
                          }`}>
                            {driver.is_active ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {editingDriver?.id === driver.id ? (
                              <>
                                <button
                                  onClick={() => handleUpdateDriver(editingDriver)}
                                  className="p-1 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                                  title="Speichern"
                                >
                                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                                </button>
                                <button
                                  onClick={() => setEditingDriver(null)}
                                  className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                  title="Abbrechen"
                                >
                                  <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => setEditingDriver(driver)}
                                  className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                  title="Bearbeiten"
                                >
                                  <Pencil className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </button>
                                <button
                                  onClick={() => handleToggleDriverStatus(driver)}
                                  className="p-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded transition-colors"
                                  title={driver.is_active ? 'Deaktivieren' : 'Aktivieren'}
                                >
                                  {driver.is_active ? (
                                    <PowerOff className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                  ) : (
                                    <Power className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {drivers.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                    Keine Fahrer gefunden
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Einstellungen
            </h2>
            <div className="space-y-4">
              <div>
                <label className="label-text">Design-Modus</label>
                <button
                  onClick={toggleDarkMode}
                  className="btn-secondary flex items-center gap-2"
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  {isDark ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
                </button>
              </div>

              <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  Über die Anwendung
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">
                  Trans Oflex Admin Dashboard
                </p>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Version 2.1.0
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-200 dark:border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 text-center text-xs text-gray-500 dark:text-slate-400">
          <p>Created by Mahmoud Shehab — V2.1.0</p>
        </div>
      </footer>
    </div>
  );
}
