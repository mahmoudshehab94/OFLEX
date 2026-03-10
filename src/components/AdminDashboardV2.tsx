import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, Driver, WorkEntry, UserAccount, getAllUserAccounts, generatePassword, resetUserPassword, getDriversWithAccounts } from '../lib/supabase';
import {
  Users, FileText, BarChart3, Plus, Pencil, Trash2,
  Check, X, Search, Download, LogOut,
  Power, PowerOff, Filter, RefreshCw, FileSpreadsheet, Settings, Clock, Moon, Sun, Loader2, Save, Scale, Key, Copy, ShieldAlert
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useDarkMode } from '../hooks/useDarkMode';
import { useDebounce } from '../hooks/useDebounce';
import { InviteManagement } from './InviteManagement';
import { DirectAccountCreation } from './DirectAccountCreation';
import { useAuth } from '../contexts/AuthContext';
import { getPermissions } from '../lib/permissions';

interface Message {
  type: 'success' | 'error';
  text: string;
}

type TabType = 'dashboard' | 'reports' | 'entries' | 'drivers' | 'invites' | 'users' | 'settings';

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

interface EditingEntry {
  id: string;
  driver_id: string;
  vehicle: string;
  date: string;
  start_time: string;
  end_time: string;
  notes: string;
}

type PeriodType = 'diese_woche' | 'letzte_woche' | 'dieser_monat' | 'letzter_monat' | 'dieses_jahr' | 'letztes_jahr';

const STANDARD_HOURS = 8;

export default function AdminDashboardV2({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();

  if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
    window.history.pushState({}, '', '/');
    window.location.reload();
    return null;
  }

  const permissions = getPermissions(user?.role as 'admin' | 'supervisor' | 'driver' | null);
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
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);

  const [todayEntries, setTodayEntries] = useState<WorkEntry[]>([]);
  const [loadingToday, setLoadingToday] = useState(false);

  const [monthlyDriver, setMonthlyDriver] = useState('');
  const [monthlyDriverSearch, setMonthlyDriverSearch] = useState('');
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear());
  const [monthlyMonth, setMonthlyMonth] = useState(new Date().getMonth() + 1);
  const [monthlyReport, setMonthlyReport] = useState<{ driver: Driver, entries: WorkEntry[], summary: ReportSummary } | null>(null);

  const [customDriver, setCustomDriver] = useState('');
  const [customDriverSearch, setCustomDriverSearch] = useState('');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [customReport, setCustomReport] = useState<{ driver: Driver, entries: WorkEntry[], summary: ReportSummary } | null>(null);

  const [compareDriver1, setCompareDriver1] = useState('');
  const [compareDriver1Search, setCompareDriver1Search] = useState('');
  const [compareDriver2, setCompareDriver2] = useState('');
  const [compareDriver2Search, setCompareDriver2Search] = useState('');
  const [comparePeriod, setComparePeriod] = useState<PeriodType>('dieser_monat');
  const [comparison, setComparison] = useState<{ driver1: { driver: Driver, summary: ReportSummary }, driver2: { driver: Driver, summary: ReportSummary } } | null>(null);

  const [vehicleLookup, setVehicleLookup] = useState('');
  const [vehicleDate, setVehicleDate] = useState('');
  const [vehicleResult, setVehicleResult] = useState<{ driver: Driver, entry: WorkEntry } | null>(null);
  const [lookingUpVehicle, setLookingUpVehicle] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [userSearchText, setUserSearchText] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'supervisor' | 'driver'>('all');
  const [filteredUserAccounts, setFilteredUserAccounts] = useState<UserAccount[]>([]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    loadDrivers();
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') loadDashboardStats();
    if (activeTab === 'reports') loadTodayEntries();
    if (activeTab === 'drivers') loadDrivers();
    if (activeTab === 'entries') { loadDrivers(); loadEntries(); }
    if (activeTab === 'users') loadUserAccounts();
  }, [activeTab]);

  useEffect(() => {
    if (debouncedSearch.length > 0) {
      searchDrivers(debouncedSearch);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    let filtered = userAccounts;

    if (userRoleFilter !== 'all') {
      filtered = filtered.filter(account => account.role === userRoleFilter);
    }

    if (userSearchText.trim()) {
      const searchLower = userSearchText.toLowerCase();
      filtered = filtered.filter(account => {
        const matchesUsername = account.username.toLowerCase().includes(searchLower);
        const matchesEmail = account.email.toLowerCase().includes(searchLower);
        const matchesDriverName = account.driver_name?.toLowerCase().includes(searchLower);
        return matchesUsername || matchesEmail || matchesDriverName;
      });
    }

    setFilteredUserAccounts(filtered);
  }, [userAccounts, userSearchText, userRoleFilter]);

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

  const getDriverSuggestions = (search: string): Driver[] => {
    if (!search) return [];
    const lowerSearch = search.toLowerCase();
    return drivers.filter(d =>
      d.driver_code.toLowerCase().includes(lowerSearch) ||
      d.driver_name.toLowerCase().includes(lowerSearch)
    );
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
    let fromMinutes = fromH * 60 + fromM;
    let toMinutes = toH * 60 + toM;

    if (toMinutes < fromMinutes) {
      toMinutes += 24 * 60;
    }

    return (toMinutes - fromMinutes) / 60;
  };

  const formatHours = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const calculateSummary = (entries: WorkEntry[]): ReportSummary => {
    const arbeitstage = new Set(entries.map(e => e.date)).size;
    const totalHours = entries.reduce((sum, e) => sum + calculateDuration(e.start_time, e.end_time), 0);
    const overtimeHours = entries.reduce((sum, e) => {
      const daily = calculateDuration(e.start_time, e.end_time);
      return sum + Math.max(0, daily - STANDARD_HOURS);
    }, 0);

    return {
      arbeitstage,
      gesamtarbeitszeit: formatHours(totalHours),
      uberstunden: formatHours(overtimeHours),
      totalHours,
      overtimeHours
    };
  };

  const getDateRange = (period: PeriodType): { from: string, to: string } => {
    const now = new Date();
    let from: Date, to: Date;

    switch (period) {
      case 'diese_woche': {
        const day = now.getDay();
        const diff = day === 0 ? 6 : day - 1;
        from = new Date(now);
        from.setDate(now.getDate() - diff);
        to = new Date(from);
        to.setDate(from.getDate() + 6);
        break;
      }
      case 'letzte_woche': {
        const day = now.getDay();
        const diff = day === 0 ? 6 : day - 1;
        from = new Date(now);
        from.setDate(now.getDate() - diff - 7);
        to = new Date(from);
        to.setDate(from.getDate() + 6);
        break;
      }
      case 'dieser_monat': {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      }
      case 'letzter_monat': {
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        to = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      }
      case 'dieses_jahr': {
        from = new Date(now.getFullYear(), 0, 1);
        to = new Date(now.getFullYear(), 11, 31);
        break;
      }
      case 'letztes_jahr': {
        from = new Date(now.getFullYear() - 1, 0, 1);
        to = new Date(now.getFullYear() - 1, 11, 31);
        break;
      }
    }

    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0]
    };
  };

  const loadDrivers = async () => {
    if (!supabase) return;

    try {
      const result = await getDriversWithAccounts();
      if (result.success && result.drivers) {
        setDrivers(result.drivers);
      } else {
        throw new Error(result.error || 'Failed to load drivers');
      }
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

  const loadTodayEntries = async () => {
    if (!supabase) return;
    setLoadingToday(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      const { data, error } = await supabase
        .from('work_entries')
        .select('*, drivers(driver_code, driver_name)')
        .eq('date', today)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setTodayEntries(data || []);
    } catch (error) {
      console.error('Error loading today entries:', error);
      setMessage({ type: 'error', text: 'Fehler beim Laden der heutigen Einträge' });
    } finally {
      setLoadingToday(false);
    }
  };

  const handleUpdateEntry = async () => {
    if (!supabase || !editingEntry) return;

    if (!permissions.canModifyWorkEntries) {
      setMessage({ type: 'error', text: 'Sie haben keine Berechtigung, Einträge zu ändern' });
      return;
    }

    try {
      const { error } = await supabase
        .from('work_entries')
        .update({
          driver_id: editingEntry.driver_id,
          vehicle: editingEntry.vehicle || null,
          date: editingEntry.date,
          start_time: editingEntry.start_time,
          end_time: editingEntry.end_time,
          notes: editingEntry.notes || null
        })
        .eq('id', editingEntry.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Eintrag aktualisiert' });
      setEditingEntry(null);
      loadEntries();
      if (activeTab === 'reports') loadTodayEntries();
    } catch (error) {
      console.error('Error updating entry:', error);
      setMessage({ type: 'error', text: 'Fehler beim Aktualisieren' });
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

    if (!permissions.canModifyWorkEntries) {
      setMessage({ type: 'error', text: 'Sie haben keine Berechtigung, Einträge zu ändern' });
      return;
    }

    if (!confirm('Eintrag wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('work_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Eintrag gelöscht' });
      loadEntries();
      if (activeTab === 'reports') loadTodayEntries();
      if (activeTab === 'dashboard') loadDashboardStats();
    } catch (error) {
      console.error('Error deleting entry:', error);
      setMessage({ type: 'error', text: 'Fehler beim Löschen' });
    }
  };

  const handleBulkDelete = async () => {
    if (!supabase) return;

    if (!permissions.canModifyWorkEntries) {
      setMessage({ type: 'error', text: 'Sie haben keine Berechtigung, Einträge zu ändern' });
      return;
    }

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
        if (activeTab === 'reports') loadTodayEntries();
        if (activeTab === 'dashboard') loadDashboardStats();
      }
    } catch (error) {
      console.error('Error bulk deleting:', error);
      setMessage({ type: 'error', text: 'Fehler beim Löschen' });
    }
  };

  const handleGenerateMonthlyReport = async () => {
    if (!supabase) return;

    // Resolve driver ID from search text to avoid stale state
    const suggestions = getDriverSuggestions(monthlyDriverSearch);
    const resolvedDriverId = suggestions.length > 0 ? suggestions[0].id : monthlyDriver;

    if (!resolvedDriverId) {
      setMessage({ type: 'error', text: 'Bitte Fahrer auswählen' });
      return;
    }

    const startDate = `${monthlyYear}-${String(monthlyMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(monthlyYear, monthlyMonth, 0).getDate();
    const endDate = `${monthlyYear}-${String(monthlyMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    try {
      const { data: driver } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', resolvedDriverId)
        .single();

      const { data: entries } = await supabase
        .from('work_entries')
        .select('*')
        .eq('driver_id', resolvedDriverId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (!driver) {
        setMessage({ type: 'error', text: 'Fahrer nicht gefunden' });
        return;
      }

      const summary = calculateSummary(entries || []);
      setMonthlyReport({ driver, entries: entries || [], summary });
    } catch (error) {
      console.error('Error generating monthly report:', error);
      setMessage({ type: 'error', text: 'Fehler beim Erstellen des Berichts' });
    }
  };

  const handleGenerateCustomReport = async () => {
    if (!supabase) return;

    // Resolve driver ID from search text to avoid stale state
    const suggestions = getDriverSuggestions(customDriverSearch);
    const resolvedDriverId = suggestions.length > 0 ? suggestions[0].id : customDriver;

    if (!resolvedDriverId || !customDateFrom || !customDateTo) {
      setMessage({ type: 'error', text: 'Bitte alle Felder ausfüllen' });
      return;
    }

    try {
      const { data: driver } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', resolvedDriverId)
        .single();

      const { data: entries } = await supabase
        .from('work_entries')
        .select('*')
        .eq('driver_id', resolvedDriverId)
        .gte('date', customDateFrom)
        .lte('date', customDateTo)
        .order('date', { ascending: true });

      if (!driver) {
        setMessage({ type: 'error', text: 'Fahrer nicht gefunden' });
        return;
      }

      const summary = calculateSummary(entries || []);
      setCustomReport({ driver, entries: entries || [], summary });
    } catch (error) {
      console.error('Error generating custom report:', error);
      setMessage({ type: 'error', text: 'Fehler beim Erstellen des Berichts' });
    }
  };

  const handleCompareDrivers = async () => {
    if (!supabase) return;

    // Resolve driver IDs from search text to avoid stale state
    const suggestions1 = getDriverSuggestions(compareDriver1Search);
    const resolvedDriver1Id = suggestions1.length > 0 ? suggestions1[0].id : compareDriver1;

    const suggestions2 = getDriverSuggestions(compareDriver2Search);
    const resolvedDriver2Id = suggestions2.length > 0 ? suggestions2[0].id : compareDriver2;

    if (!resolvedDriver1Id || !resolvedDriver2Id) {
      setMessage({ type: 'error', text: 'Bitte beide Fahrer auswählen' });
      return;
    }

    const { from, to } = getDateRange(comparePeriod);

    try {
      const results = await Promise.all([resolvedDriver1Id, resolvedDriver2Id].map(async (driverId) => {
        const { data: driver } = await supabase
          .from('drivers')
          .select('*')
          .eq('id', driverId)
          .single();

        const { data: entries } = await supabase
          .from('work_entries')
          .select('*')
          .eq('driver_id', driverId)
          .gte('date', from)
          .lte('date', to);

        if (!driver || !entries) return null;

        const summary = calculateSummary(entries);

        return { driver, summary };
      }));

      if (results[0] && results[1]) {
        setComparison({
          driver1: results[0],
          driver2: results[1]
        });
      } else {
        setMessage({ type: 'error', text: 'Fehler beim Laden der Fahrerdaten' });
      }
    } catch (error) {
      console.error('Error comparing drivers:', error);
      setMessage({ type: 'error', text: 'Fehler beim Vergleichen' });
    }
  };

  const exportPDF = (driver: Driver, entries: WorkEntry[], summary: ReportSummary, startDate: string, endDate: string) => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Arbeitszeitbericht', 14, 20);

    doc.setFontSize(12);
    doc.text(`Fahrer: ${driver.driver_name} (${driver.driver_code})`, 14, 30);
    doc.text(`Zeitraum: ${startDate} bis ${endDate}`, 14, 37);
    doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 14, 44);

    doc.setFontSize(10);
    doc.text(`Arbeitstage: ${summary.arbeitstage}`, 14, 55);
    doc.text(`Gesamtarbeitszeit: ${summary.gesamtarbeitszeit}`, 14, 62);
    doc.text(`Überstunden: ${summary.uberstunden}`, 14, 69);

    if (entries.length > 0) {
      const tableData = entries.map(entry => {
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

    doc.save(`Bericht_${driver.driver_code}_${startDate}_${endDate}.pdf`);
    setMessage({ type: 'success', text: 'PDF erfolgreich exportiert' });
  };

  const exportExcel = (driver: Driver, entries: WorkEntry[], summary: ReportSummary, startDate: string, endDate: string) => {
    const excelData = entries.map(entry => {
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
    XLSX.writeFile(wb, `Bericht_${driver.driver_code}_${startDate}_${endDate}.xlsx`);
    setMessage({ type: 'success', text: 'Excel erfolgreich exportiert' });
  };

  const handleVehicleLookup = async () => {
    if (!supabase || !vehicleLookup.trim() || !vehicleDate) {
      setMessage({ type: 'error', text: 'Bitte Fahrzeug und Datum eingeben' });
      return;
    }

    setLookingUpVehicle(true);

    try {
      const { data: entry, error: entryError } = await supabase
        .from('work_entries')
        .select('*, drivers(*)')
        .ilike('vehicle', vehicleLookup.trim())
        .eq('date', vehicleDate)
        .maybeSingle();

      if (entryError) throw entryError;

      if (entry) {
        const driverData = (entry as any).drivers;
        setVehicleResult({
          driver: driverData,
          entry: entry
        });
        setMessage({ type: 'success', text: 'Fahrzeug gefunden' });
      } else {
        setVehicleResult(null);
        setMessage({ type: 'error', text: 'Kein Eintrag für dieses Fahrzeug an diesem Tag gefunden' });
      }
    } catch (error) {
      console.error('Vehicle lookup error:', error);
      setMessage({ type: 'error', text: 'Fehler bei der Fahrzeugsuche' });
      setVehicleResult(null);
    } finally {
      setLookingUpVehicle(false);
    }
  };

  const handleChangePassword = async () => {
    if (!supabase) return;

    if (!newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'Bitte alle Felder ausfüllen' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Passwort muss mindestens 6 Zeichen lang sein' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwörter stimmen nicht überein' });
      return;
    }

    setChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Passwort erfolgreich geändert' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Password change error:', error);
      setMessage({ type: 'error', text: error.message || 'Fehler beim Ändern des Passworts' });
    } finally {
      setChangingPassword(false);
    }
  };

  const loadUserAccounts = async () => {
    setLoadingUsers(true);
    try {
      const result = await getAllUserAccounts();
      if (result.success && result.users) {
        setUserAccounts(result.users);
      } else {
        setMessage({ type: 'error', text: result.error || 'Fehler beim Laden der Benutzer' });
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setMessage({ type: 'error', text: 'Fehler beim Laden der Benutzer' });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleGeneratePassword = () => {
    const password = generatePassword(12);
    setGeneratedPassword(password);
  };

  const handleResetPassword = async (userId: string) => {
    if (!permissions.canResetPasswords) {
      setMessage({ type: 'error', text: 'Sie haben keine Berechtigung, Passwörter zurückzusetzen' });
      return;
    }

    if (!generatedPassword) {
      setMessage({ type: 'error', text: 'Bitte generieren Sie zuerst ein Passwort' });
      return;
    }

    setResettingPassword(true);
    try {
      const result = await resetUserPassword(userId, generatedPassword);
      if (result.success) {
        setMessage({ type: 'success', text: 'Passwort erfolgreich zurückgesetzt' });
        setResetPasswordUserId(null);
        setGeneratedPassword(null);
      } else {
        setMessage({ type: 'error', text: result.error || 'Fehler beim Zurücksetzen des Passworts' });
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      setMessage({ type: 'error', text: 'Fehler beim Zurücksetzen des Passworts' });
    } finally {
      setResettingPassword(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: 'In Zwischenablage kopiert' });
  };

  const handleDeleteDriver = async (driver: Driver) => {
    if (!supabase) return;

    const confirmDelete = window.confirm(
      `Möchten Sie den Fahrer "${driver.driver_name}" (${driver.driver_code}) wirklich DAUERHAFT löschen?\n\nWARNUNG: Alle zugehörigen Arbeitseinträge werden ebenfalls gelöscht! Diese Aktion kann nicht rückgängig gemacht werden.`
    );

    if (!confirmDelete) return;

    try {
      const { error: entriesError } = await supabase
        .from('work_entries')
        .delete()
        .eq('driver_id', driver.id);

      if (entriesError) throw entriesError;

      const { error: driverError } = await supabase
        .from('drivers')
        .delete()
        .eq('id', driver.id);

      if (driverError) throw driverError;

      setMessage({ type: 'success', text: 'Fahrer und alle zugehörigen Einträge wurden gelöscht' });
      loadDrivers();
    } catch (error) {
      console.error('Error deleting driver:', error);
      setMessage({ type: 'error', text: 'Fehler beim Löschen des Fahrers' });
    }
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
              { id: 'reports', label: 'Berichte', icon: FileText, requiresPermission: 'canViewReports' },
              { id: 'entries', label: 'Einträge', icon: Clock },
              { id: 'drivers', label: 'Fahrer', icon: Users },
              { id: 'invites', label: 'Einladungen', icon: Plus },
              { id: 'users', label: 'Benutzer', icon: ShieldAlert, requiresPermission: 'canResetPasswords' },
              { id: 'settings', label: 'Einstellungen', icon: Settings }
            ]
              .filter(tab => !tab.requiresPermission || permissions[tab.requiresPermission as keyof typeof permissions])
              .map(tab => {
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
                      heute
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
                      heute
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Heutige Einträge
                </h2>
                <button
                  onClick={loadTodayEntries}
                  disabled={loadingToday}
                  className="btn-icon"
                  title="Aktualisieren"
                >
                  <RefreshCw className={`w-5 h-5 ${loadingToday ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {todayEntries.length === 0 ? (
                <p className="text-gray-500 dark:text-slate-400 text-center py-8">
                  Keine Einträge für heute
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-700">
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Datum</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Fahrer</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Fahrzeug</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Von</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Bis</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Dauer</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Notiz</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayEntries.map(entry => {
                        const hours = calculateDuration(entry.start_time, entry.end_time);
                        const driverInfo = (entry as any).drivers;

                        if (editingEntry?.id === entry.id) {
                          return (
                            <tr key={entry.id} className="border-b border-gray-200 dark:border-slate-700">
                              <td className="py-3 px-4">
                                <input
                                  type="date"
                                  value={editingEntry.date}
                                  onChange={(e) => setEditingEntry({ ...editingEntry, date: e.target.value })}
                                  className="input-field py-1 text-sm"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <select
                                  value={editingEntry.driver_id}
                                  onChange={(e) => setEditingEntry({ ...editingEntry, driver_id: e.target.value })}
                                  className="input-field py-1 text-sm"
                                >
                                  {drivers.filter(d => d.is_active).map(d => (
                                    <option key={d.id} value={d.id}>{d.driver_name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={editingEntry.vehicle}
                                  onChange={(e) => setEditingEntry({ ...editingEntry, vehicle: e.target.value })}
                                  className="input-field py-1 text-sm"
                                  placeholder="z.B. B AB 1234"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="time"
                                  value={editingEntry.start_time}
                                  onChange={(e) => setEditingEntry({ ...editingEntry, start_time: e.target.value })}
                                  className="input-field py-1 text-sm"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="time"
                                  value={editingEntry.end_time}
                                  onChange={(e) => setEditingEntry({ ...editingEntry, end_time: e.target.value })}
                                  className="input-field py-1 text-sm"
                                />
                              </td>
                              <td className="py-3 px-4">
                                {formatHours(calculateDuration(editingEntry.start_time, editingEntry.end_time))}
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={editingEntry.notes}
                                  onChange={(e) => setEditingEntry({ ...editingEntry, notes: e.target.value })}
                                  className="input-field py-1 text-sm"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleUpdateEntry}
                                    className="p-1 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                    title="Speichern"
                                  >
                                    <Save className="w-4 h-4 text-green-600 dark:text-green-400" />
                                  </button>
                                  <button
                                    onClick={() => setEditingEntry(null)}
                                    className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                    title="Abbrechen"
                                  >
                                    <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={entry.id} className="border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                            <td className="py-3 px-4">{entry.date}</td>
                            <td className="py-3 px-4">{driverInfo?.driver_name || '-'}</td>
                            <td className="py-3 px-4">{entry.vehicle || '-'}</td>
                            <td className="py-3 px-4">{entry.start_time}</td>
                            <td className="py-3 px-4">{entry.end_time}</td>
                            <td className="py-3 px-4">{formatHours(hours)}</td>
                            <td className="py-3 px-4">{entry.notes || '-'}</td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    if (!permissions.canModifyWorkEntries) {
                                      setMessage({ type: 'error', text: 'Sie haben keine Berechtigung, Einträge zu ändern' });
                                      return;
                                    }
                                    setEditingEntry({
                                      id: entry.id,
                                      driver_id: entry.driver_id,
                                      vehicle: entry.vehicle || '',
                                      date: entry.date,
                                      start_time: entry.start_time,
                                      end_time: entry.end_time,
                                      notes: entry.notes || ''
                                    });
                                  }}
                                  className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={permissions.canModifyWorkEntries ? "Bearbeiten" : "Keine Berechtigung"}
                                  disabled={!permissions.canModifyWorkEntries}
                                >
                                  <Pencil className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </button>
                                <button
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={permissions.canModifyWorkEntries ? "Löschen" : "Keine Berechtigung"}
                                  disabled={!permissions.canModifyWorkEntries}
                                >
                                  <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Monatsbericht
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="label-text">Fahrer (Code oder Name)</label>
                  <input
                    type="text"
                    value={monthlyDriverSearch}
                    onChange={(e) => {
                      setMonthlyDriverSearch(e.target.value);
                      const suggestions = getDriverSuggestions(e.target.value);
                      if (suggestions.length > 0) {
                        setMonthlyDriver(suggestions[0].id);
                      }
                    }}
                    onBlur={() => {
                      const suggestions = getDriverSuggestions(monthlyDriverSearch);
                      if (suggestions.length > 0) {
                        setMonthlyDriver(suggestions[0].id);
                        setMonthlyDriverSearch(`${suggestions[0].driver_code} - ${suggestions[0].driver_name}`);
                      }
                    }}
                    placeholder="Code oder Name eingeben"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">Jahr</label>
                  <input
                    type="number"
                    value={monthlyYear}
                    onChange={(e) => setMonthlyYear(parseInt(e.target.value))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">Monat</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={monthlyMonth}
                    onChange={(e) => setMonthlyMonth(parseInt(e.target.value))}
                    className="input-field"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateMonthlyReport}
                  className="btn-primary flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Bericht erstellen
                </button>
                {monthlyReport && (
                  <>
                    <button
                      onClick={() => {
                        const startDate = `${monthlyYear}-${String(monthlyMonth).padStart(2, '0')}-01`;
                        const lastDay = new Date(monthlyYear, monthlyMonth, 0).getDate();
                        const endDate = `${monthlyYear}-${String(monthlyMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                        exportPDF(monthlyReport.driver, monthlyReport.entries, monthlyReport.summary, startDate, endDate);
                      }}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      PDF
                    </button>
                    <button
                      onClick={() => {
                        const startDate = `${monthlyYear}-${String(monthlyMonth).padStart(2, '0')}-01`;
                        const lastDay = new Date(monthlyYear, monthlyMonth, 0).getDate();
                        const endDate = `${monthlyYear}-${String(monthlyMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                        exportExcel(monthlyReport.driver, monthlyReport.entries, monthlyReport.summary, startDate, endDate);
                      }}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Excel
                    </button>
                  </>
                )}
              </div>

              {monthlyReport && (
                <div className="mt-6 border-t border-gray-200 dark:border-slate-700 pt-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                    {monthlyReport.driver.driver_name} ({monthlyReport.driver.driver_code})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
                      <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Arbeitstage</div>
                      <div className="text-2xl font-bold text-blue-900 dark:text-blue-200">{monthlyReport.summary.arbeitstage}</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4">
                      <div className="text-sm text-green-600 dark:text-green-400 font-medium">Gesamtarbeitszeit</div>
                      <div className="text-2xl font-bold text-green-900 dark:text-green-200">{monthlyReport.summary.gesamtarbeitszeit}</div>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-4">
                      <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">Überstunden</div>
                      <div className="text-2xl font-bold text-orange-900 dark:text-orange-200">{monthlyReport.summary.uberstunden}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Zeitraum-Bericht
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="label-text">Fahrer (Code oder Name)</label>
                  <input
                    type="text"
                    value={customDriverSearch}
                    onChange={(e) => {
                      setCustomDriverSearch(e.target.value);
                      const suggestions = getDriverSuggestions(e.target.value);
                      if (suggestions.length > 0) {
                        setCustomDriver(suggestions[0].id);
                      }
                    }}
                    onBlur={() => {
                      const suggestions = getDriverSuggestions(customDriverSearch);
                      if (suggestions.length > 0) {
                        setCustomDriver(suggestions[0].id);
                        setCustomDriverSearch(`${suggestions[0].driver_code} - ${suggestions[0].driver_name}`);
                      }
                    }}
                    placeholder="Code oder Name eingeben"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">Von Datum</label>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">Bis Datum</label>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateCustomReport}
                  className="btn-primary flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Bericht erstellen
                </button>
                {customReport && (
                  <>
                    <button
                      onClick={() => exportPDF(customReport.driver, customReport.entries, customReport.summary, customDateFrom, customDateTo)}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      PDF
                    </button>
                    <button
                      onClick={() => exportExcel(customReport.driver, customReport.entries, customReport.summary, customDateFrom, customDateTo)}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Excel
                    </button>
                  </>
                )}
              </div>

              {customReport && (
                <div className="mt-6 border-t border-gray-200 dark:border-slate-700 pt-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                    {customReport.driver.driver_name} ({customReport.driver.driver_code})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
                      <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Arbeitstage</div>
                      <div className="text-2xl font-bold text-blue-900 dark:text-blue-200">{customReport.summary.arbeitstage}</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4">
                      <div className="text-sm text-green-600 dark:text-green-400 font-medium">Gesamtarbeitszeit</div>
                      <div className="text-2xl font-bold text-green-900 dark:text-green-200">{customReport.summary.gesamtarbeitszeit}</div>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-4">
                      <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">Überstunden</div>
                      <div className="text-2xl font-bold text-orange-900 dark:text-orange-200">{customReport.summary.uberstunden}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5" />
                Fahrer vergleichen
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="label-text">Fahrer 1</label>
                  <input
                    type="text"
                    value={compareDriver1Search}
                    onChange={(e) => {
                      setCompareDriver1Search(e.target.value);
                      const suggestions = getDriverSuggestions(e.target.value);
                      if (suggestions.length > 0) {
                        setCompareDriver1(suggestions[0].id);
                      }
                    }}
                    onBlur={() => {
                      const suggestions = getDriverSuggestions(compareDriver1Search);
                      if (suggestions.length > 0) {
                        setCompareDriver1(suggestions[0].id);
                        setCompareDriver1Search(`${suggestions[0].driver_code} - ${suggestions[0].driver_name}`);
                      }
                    }}
                    placeholder="Code oder Name eingeben"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">Fahrer 2</label>
                  <input
                    type="text"
                    value={compareDriver2Search}
                    onChange={(e) => {
                      setCompareDriver2Search(e.target.value);
                      const suggestions = getDriverSuggestions(e.target.value);
                      if (suggestions.length > 0) {
                        setCompareDriver2(suggestions[0].id);
                      }
                    }}
                    onBlur={() => {
                      const suggestions = getDriverSuggestions(compareDriver2Search);
                      if (suggestions.length > 0) {
                        setCompareDriver2(suggestions[0].id);
                        setCompareDriver2Search(`${suggestions[0].driver_code} - ${suggestions[0].driver_name}`);
                      }
                    }}
                    placeholder="Code oder Name eingeben"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">Zeitraum</label>
                  <select
                    value={comparePeriod}
                    onChange={(e) => setComparePeriod(e.target.value as PeriodType)}
                    className="input-field"
                  >
                    <option value="diese_woche">Diese Woche</option>
                    <option value="letzte_woche">Letzte Woche</option>
                    <option value="dieser_monat">Dieser Monat</option>
                    <option value="letzter_monat">Letzter Monat</option>
                    <option value="dieses_jahr">Dieses Jahr</option>
                    <option value="letztes_jahr">Letztes Jahr</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleCompareDrivers}
                className="btn-primary flex items-center gap-2"
              >
                <Scale className="w-4 h-4" />
                Vergleichen
              </button>

              {comparison && (
                <div className="mt-6 border-t border-gray-200 dark:border-slate-700 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                        {comparison.driver1.driver.driver_name} ({comparison.driver1.driver.driver_code})
                      </h3>
                      <div className="space-y-3">
                        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
                          <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Arbeitstage</div>
                          <div className="text-xl font-bold text-blue-900 dark:text-blue-200">{comparison.driver1.summary.arbeitstage}</div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
                          <div className="text-sm text-green-600 dark:text-green-400 font-medium">Gesamtarbeitszeit</div>
                          <div className="text-xl font-bold text-green-900 dark:text-green-200">{comparison.driver1.summary.gesamtarbeitszeit}</div>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-3">
                          <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">Überstunden</div>
                          <div className="text-xl font-bold text-orange-900 dark:text-orange-200">{comparison.driver1.summary.uberstunden}</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                        {comparison.driver2.driver.driver_name} ({comparison.driver2.driver.driver_code})
                      </h3>
                      <div className="space-y-3">
                        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
                          <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Arbeitstage</div>
                          <div className="text-xl font-bold text-blue-900 dark:text-blue-200">{comparison.driver2.summary.arbeitstage}</div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
                          <div className="text-sm text-green-600 dark:text-green-400 font-medium">Gesamtarbeitszeit</div>
                          <div className="text-xl font-bold text-green-900 dark:text-green-200">{comparison.driver2.summary.gesamtarbeitszeit}</div>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-3">
                          <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">Überstunden</div>
                          <div className="text-xl font-bold text-orange-900 dark:text-orange-200">{comparison.driver2.summary.uberstunden}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
                  className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!permissions.canModifyWorkEntries}
                  title={permissions.canModifyWorkEntries ? "" : "Keine Berechtigung"}
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
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Von</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Bis</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Dauer</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Notiz</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(entry => {
                      const hours = calculateDuration(entry.start_time, entry.end_time);
                      const driverInfo = (entry as any).drivers;

                      if (editingEntry?.id === entry.id) {
                        return (
                          <tr key={entry.id} className="border-b border-gray-200 dark:border-slate-700">
                            <td className="py-3 px-4">
                              <input
                                type="checkbox"
                                checked={selectedEntries.has(entry.id)}
                                onChange={() => toggleSelectEntry(entry.id)}
                                className="rounded"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="date"
                                value={editingEntry.date}
                                onChange={(e) => setEditingEntry({ ...editingEntry, date: e.target.value })}
                                className="input-field py-1 text-sm"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={editingEntry.driver_id}
                                onChange={(e) => setEditingEntry({ ...editingEntry, driver_id: e.target.value })}
                                className="input-field py-1 text-sm"
                              >
                                {drivers.filter(d => d.is_active).map(d => (
                                  <option key={d.id} value={d.id}>{d.driver_name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="text"
                                value={editingEntry.vehicle}
                                onChange={(e) => setEditingEntry({ ...editingEntry, vehicle: e.target.value })}
                                className="input-field py-1 text-sm"
                                placeholder="z.B. B AB 1234"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="time"
                                value={editingEntry.start_time}
                                onChange={(e) => setEditingEntry({ ...editingEntry, start_time: e.target.value })}
                                className="input-field py-1 text-sm"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="time"
                                value={editingEntry.end_time}
                                onChange={(e) => setEditingEntry({ ...editingEntry, end_time: e.target.value })}
                                className="input-field py-1 text-sm"
                              />
                            </td>
                            <td className="py-3 px-4">
                              {formatHours(calculateDuration(editingEntry.start_time, editingEntry.end_time))}
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="text"
                                value={editingEntry.notes}
                                onChange={(e) => setEditingEntry({ ...editingEntry, notes: e.target.value })}
                                className="input-field py-1 text-sm"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={handleUpdateEntry}
                                  className="p-1 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                  title="Speichern"
                                >
                                  <Save className="w-4 h-4 text-green-600 dark:text-green-400" />
                                </button>
                                <button
                                  onClick={() => setEditingEntry(null)}
                                  className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                  title="Abbrechen"
                                >
                                  <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

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
                            {driverInfo?.driver_name || '-'}
                          </td>
                          <td className="py-3 px-4">{entry.vehicle || '-'}</td>
                          <td className="py-3 px-4">{entry.start_time}</td>
                          <td className="py-3 px-4">{entry.end_time}</td>
                          <td className="py-3 px-4">{formatHours(hours)}</td>
                          <td className="py-3 px-4">{entry.notes || '-'}</td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (!permissions.canModifyWorkEntries) {
                                    setMessage({ type: 'error', text: 'Sie haben keine Berechtigung, Einträge zu ändern' });
                                    return;
                                  }
                                  setEditingEntry({
                                    id: entry.id,
                                    driver_id: entry.driver_id,
                                    vehicle: entry.vehicle || '',
                                    date: entry.date,
                                    start_time: entry.start_time,
                                    end_time: entry.end_time,
                                    notes: entry.notes || ''
                                  });
                                }}
                                className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                title={permissions.canModifyWorkEntries ? "Bearbeiten" : "Keine Berechtigung"}
                                disabled={!permissions.canModifyWorkEntries}
                              >
                                <Pencil className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </button>
                              <button
                                onClick={() => handleDeleteEntry(entry.id)}
                                className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                title={permissions.canModifyWorkEntries ? "Löschen" : "Keine Berechtigung"}
                                disabled={!permissions.canModifyWorkEntries}
                              >
                                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </button>
                            </div>
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Search className="w-5 h-5" />
                Fahrzeug-Suche (Verkehrsstrafen)
              </h2>
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                Finden Sie schnell heraus, welcher Fahrer ein bestimmtes Fahrzeug an einem Tag genutzt hat.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="label-text">Fahrzeug</label>
                  <input
                    type="text"
                    value={vehicleLookup}
                    onChange={(e) => setVehicleLookup(e.target.value)}
                    placeholder="z.B. MI299, MI 299, mi-299"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">Datum</label>
                  <input
                    type="date"
                    value={vehicleDate}
                    onChange={(e) => setVehicleDate(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleVehicleLookup}
                    disabled={lookingUpVehicle}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {lookingUpVehicle ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Suchen
                  </button>
                </div>
              </div>

              {vehicleResult && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <h3 className="font-semibold text-green-900 dark:text-green-200 mb-2">
                    Gefunden
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-slate-400">Fahrer:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {vehicleResult.driver.driver_name} ({vehicleResult.driver.driver_code})
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-slate-400">Fahrzeug:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {vehicleResult.entry.vehicle}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-slate-400">Datum:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {vehicleResult.entry.date}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-slate-400">Zeit:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {vehicleResult.entry.start_time} - {vehicleResult.entry.end_time}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

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
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-slate-300">Konto</th>
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
                          {driver.account_email ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                                  <Check className="w-3 h-3 mr-1" />
                                  Verknüpft
                                </span>
                              </div>
                              <div className="text-xs text-gray-600 dark:text-slate-400">
                                <div className="font-medium">{driver.account_username}</div>
                                <div className="text-xs">{driver.account_email}</div>
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400">
                              <X className="w-3 h-3 mr-1" />
                              Kein Konto
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {editingDriver?.id === driver.id ? (
                              <>
                                <button
                                  onClick={() => handleUpdateDriver(editingDriver)}
                                  className="p-1 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                  title="Speichern"
                                >
                                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                                </button>
                                <button
                                  onClick={() => setEditingDriver(null)}
                                  className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                  title="Abbrechen"
                                >
                                  <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => setEditingDriver(driver)}
                                  className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                  title="Bearbeiten"
                                >
                                  <Pencil className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </button>
                                <button
                                  onClick={() => handleToggleDriverStatus(driver)}
                                  className="p-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded"
                                  title={driver.is_active ? 'Deaktivieren' : 'Aktivieren'}
                                >
                                  {driver.is_active ? (
                                    <PowerOff className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                  ) : (
                                    <Power className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleDeleteDriver(driver)}
                                  className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                  title="Dauerhaft löschen"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
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

        {activeTab === 'invites' && (
          <div className="space-y-6">
            <InviteManagement />
            <DirectAccountCreation />
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-blue-600" />
                Benutzerverwaltung
              </h2>

              <div className="mb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      <Search className="w-4 h-4 inline mr-2" />
                      Suchen
                    </label>
                    <input
                      type="text"
                      value={userSearchText}
                      onChange={(e) => setUserSearchText(e.target.value)}
                      placeholder="Benutzername, E-Mail oder Fahrername..."
                      className="input-field w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      <Filter className="w-4 h-4 inline mr-2" />
                      Rolle filtern
                    </label>
                    <select
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value as any)}
                      className="input-field w-full"
                    >
                      <option value="all">Alle Rollen</option>
                      <option value="admin">Admin</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="driver">Fahrer</option>
                    </select>
                  </div>
                </div>

                {(userSearchText || userRoleFilter !== 'all') && (
                  <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>
                      {filteredUserAccounts.length} von {userAccounts.length} Benutzer{userAccounts.length !== 1 ? 'n' : ''}
                    </span>
                    <button
                      onClick={() => {
                        setUserSearchText('');
                        setUserRoleFilter('all');
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <X className="w-4 h-4" />
                      Filter zurücksetzen
                    </button>
                  </div>
                )}
              </div>

              {loadingUsers ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : userAccounts.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                  Keine Benutzer gefunden
                </p>
              ) : filteredUserAccounts.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">
                    Keine Benutzer entsprechen den Filterkriterien
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                          Benutzername
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                          E-Mail
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                          Rolle
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                          Fahrer
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                          Erstellt
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                          Aktionen
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUserAccounts.map((userAccount) => (
                        <tr
                          key={userAccount.id}
                          className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        >
                          <td className="py-3 px-4 text-slate-900 dark:text-white">
                            {userAccount.username}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {userAccount.email}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              userAccount.role === 'admin'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                : userAccount.role === 'supervisor'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            }`}>
                              {userAccount.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {userAccount.driver_name || '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {new Date(userAccount.created_at).toLocaleDateString('de-DE')}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => {
                                setResetPasswordUserId(userAccount.id);
                                setGeneratedPassword(null);
                              }}
                              disabled={!permissions.canResetPasswords}
                              className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={permissions.canResetPasswords ? "Passwort zurücksetzen" : "Keine Berechtigung"}
                            >
                              <Key className="w-4 h-4" />
                              Zurücksetzen
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {resetPasswordUserId && (
              <div className="card p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Passwort zurücksetzen
                </h3>

                <div className="space-y-4 max-w-2xl">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleGeneratePassword}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Key className="w-4 h-4" />
                      Passwort generieren
                    </button>
                    {generatedPassword && (
                      <button
                        onClick={() => copyToClipboard(generatedPassword)}
                        className="btn-secondary flex items-center gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        Kopieren
                      </button>
                    )}
                  </div>

                  {generatedPassword && (
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-600">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Generiertes Passwort:
                      </label>
                      <code className="block p-3 bg-slate-100 dark:bg-slate-900 rounded text-lg font-mono text-slate-900 dark:text-white break-all">
                        {generatedPassword}
                      </code>
                      <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                        ⚠️ Wichtig: Kopieren Sie dieses Passwort und teilen Sie es sicher mit dem Benutzer.
                        Es kann nach dem Schließen nicht mehr angezeigt werden.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleResetPassword(resetPasswordUserId)}
                      disabled={!generatedPassword || resettingPassword}
                      className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resettingPassword ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Wird zurückgesetzt...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Passwort zurücksetzen
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setResetPasswordUserId(null);
                        setGeneratedPassword(null);
                      }}
                      className="btn-secondary"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Admin-Passwort ändern
              </h2>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="label-text">Neues Passwort</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mindestens 6 Zeichen"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">Passwort bestätigen</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Passwort wiederholen"
                    className="input-field"
                  />
                </div>
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="btn-primary flex items-center gap-2"
                >
                  {changingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Wird gespeichert...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Passwort ändern
                    </>
                  )}
                </button>
              </div>
            </div>

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
