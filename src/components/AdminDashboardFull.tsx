import React, { useState, useEffect } from 'react';
import { supabase, Driver, WorkEntry } from '../lib/supabase';
import {
  Users, FileText, BarChart3, Plus, Pencil, Trash2,
  Check, X, Search, Download, LogOut,
  Power, PowerOff, Filter, RefreshCw, FileSpreadsheet, Settings, Clock
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Message {
  type: 'success' | 'error';
  text: string;
}

type TabType = 'dashboard' | 'reports' | 'entries' | 'drivers' | 'settings';

interface EditingDriver {
  id: string;
  driver_code: string;
  driver_name: string;
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

interface ReportSummary {
  arbeitstage: number;
  gesamtarbeitszeit: string;
  uberstunden: string;
  totalHours: number;
  overtimeHours: number;
}

type PeriodType = 'diese_woche' | 'letzte_woche' | 'dieser_monat' | 'letzter_monat' | 'dieses_jahr' | 'letztes_jahr';

const STANDARD_HOURS = 9;

interface DashboardStats {
  driversSubmittedToday: number;
  driversNotSubmittedToday: Driver[];
  totalHoursToday: number;
  overtimeToday: number;
}

export default function AdminDashboardFull({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [message, setMessage] = useState<Message | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [newDriverCode, setNewDriverCode] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
  const [editingDriver, setEditingDriver] = useState<EditingDriver | null>(null);

  const [vehicleLookup, setVehicleLookup] = useState('');
  const [vehicleDate, setVehicleDate] = useState('');
  const [vehicleResult, setVehicleResult] = useState<{ driver: Driver, entry: WorkEntry } | null>(null);
  const [lookingUpVehicle, setLookingUpVehicle] = useState(false);

  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterDriverId, setFilterDriverId] = useState('');
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({
    driver_id: '',
    vehicle: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
    notes: ''
  });
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [vehicleConflict, setVehicleConflict] = useState<{ driver: Driver, entry: WorkEntry } | null>(null);
  const [showConflictDetails, setShowConflictDetails] = useState(false);

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

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (activeTab === 'dashboard') loadDashboardStats();
    if (activeTab === 'reports') loadTodayEntries();
    if (activeTab === 'entries') loadEntries();
    if (activeTab === 'drivers') loadDrivers();
  }, [activeTab]);

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

  const loadDashboardStats = async () => {
    setLoadingDashboard(true);
    const today = new Date().toISOString().split('T')[0];

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

    setLoadingDashboard(false);
  };

  const loadDrivers = async () => {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading drivers:', error);
      setMessage({ type: 'error', text: 'Fehler beim Laden der Fahrer' });
    } else {
      setDrivers(data || []);
    }
  };

  const handleAddDriver = async () => {
    if (!newDriverCode.trim() || !newDriverName.trim()) {
      setMessage({ type: 'error', text: 'Bitte Code und Name eingeben' });
      return;
    }

    const { error } = await supabase
      .from('drivers')
      .insert({
        driver_code: newDriverCode.trim(),
        driver_name: newDriverName.trim(),
        license_letters: null,
        license_numbers: null,
        is_active: true
      });

    if (error) {
      console.error('Error adding driver:', error);
      if (error.code === '23505') {
        setMessage({ type: 'error', text: 'Dieser Code ist bereits vergeben' });
      } else {
        setMessage({ type: 'error', text: 'Fehler beim Hinzufügen' });
      }
    } else {
      setMessage({ type: 'success', text: 'Fahrer hinzugefügt' });
      setNewDriverCode('');
      setNewDriverName('');
      loadDrivers();
    }
  };

  const handleUpdateDriver = async () => {
    if (!editingDriver) return;

    if (!editingDriver.driver_code.trim() || !editingDriver.driver_name.trim()) {
      setMessage({ type: 'error', text: 'Code und Name erforderlich' });
      return;
    }

    const { error } = await supabase
      .from('drivers')
      .update({
        driver_code: editingDriver.driver_code.trim(),
        driver_name: editingDriver.driver_name.trim()
      })
      .eq('id', editingDriver.id);

    if (error) {
      console.error('Error updating driver:', error);
      if (error.code === '23505') {
        setMessage({ type: 'error', text: 'Dieser Code ist bereits vergeben' });
      } else {
        setMessage({ type: 'error', text: 'Fehler beim Aktualisieren' });
      }
    } else {
      setMessage({ type: 'success', text: 'Fahrer aktualisiert' });
      setEditingDriver(null);
      loadDrivers();
    }
  };

  const handleToggleActive = async (driver: Driver) => {
    const { error } = await supabase
      .from('drivers')
      .update({ is_active: !driver.is_active })
      .eq('id', driver.id);

    if (error) {
      console.error('Error toggling active:', error);
      setMessage({ type: 'error', text: 'Fehler beim Aktualisieren' });
    } else {
      setMessage({ type: 'success', text: driver.is_active ? 'Fahrer deaktiviert' : 'Fahrer aktiviert' });
      loadDrivers();
    }
  };

  const handleDeleteDriver = async (id: string) => {
    if (!confirm('Fahrer wirklich löschen? Alle zugehörigen Einträge werden ebenfalls gelöscht.')) return;

    const { error } = await supabase
      .from('drivers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting driver:', error);
      setMessage({ type: 'error', text: 'Fehler beim Löschen' });
    } else {
      setMessage({ type: 'success', text: 'Fahrer gelöscht' });
      loadDrivers();
    }
  };

  const filteredDrivers = drivers.filter(d =>
    d.driver_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.driver_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const loadEntries = async () => {
    let query = supabase
      .from('work_entries')
      .select(`
        *,
        drivers (driver_code, driver_name)
      `)
      .order('date', { ascending: false });

    if (filterDateFrom) query = query.gte('date', filterDateFrom);
    if (filterDateTo) query = query.lte('date', filterDateTo);
    if (filterDriverId) query = query.eq('driver_id', filterDriverId);

    const { data, error } = await query;

    if (error) {
      console.error('Error loading entries:', error);
      setMessage({ type: 'error', text: 'Fehler beim Laden der Einträge' });
    } else {
      setEntries(data || []);
    }
  };

  const checkVehicleConflict = async (vehicle: string, date: string, currentDriverId?: string) => {
    if (!vehicle) return null;

    const normalizedVehicle = normalizeVehicle(vehicle);

    const { data: existingEntries } = await supabase
      .from('work_entries')
      .select('*, drivers(*)')
      .eq('date', date);

    if (existingEntries) {
      const conflict = existingEntries.find(entry => {
        if (currentDriverId && entry.driver_id === currentDriverId) return false;
        if (!entry.vehicle) return false;
        const entryVehicle = normalizeVehicle(entry.vehicle);
        return entryVehicle === normalizedVehicle;
      });

      if (conflict && (conflict as any).drivers) {
        return {
          driver: (conflict as any).drivers,
          entry: conflict
        };
      }
    }

    return null;
  };

  const handleAddEntry = async () => {
    if (!newEntry.driver_id || !newEntry.start_time || !newEntry.end_time) {
      setMessage({ type: 'error', text: 'Bitte alle Pflichtfelder ausfüllen' });
      return;
    }

    if (!vehicleConflict) {
      const conflict = await checkVehicleConflict(newEntry.vehicle, newEntry.date, newEntry.driver_id);
      if (conflict) {
        setVehicleConflict(conflict);
        return;
      }
    }

    setVehicleConflict(null);
    setShowConflictDetails(false);

    const { data: existing } = await supabase
      .from('work_entries')
      .select('id')
      .eq('driver_id', newEntry.driver_id)
      .eq('date', newEntry.date);

    if (existing && existing.length > 0) {
      setMessage({ type: 'error', text: 'Für diesen Tag existiert bereits ein Eintrag' });
      return;
    }

    const { error } = await supabase
      .from('work_entries')
      .insert({
        driver_id: newEntry.driver_id,
        vehicle: newEntry.vehicle || null,
        date: newEntry.date,
        start_time: newEntry.start_time,
        end_time: newEntry.end_time,
        break_minutes: 0,
        notes: newEntry.notes || null
      });

    if (error) {
      console.error('Error adding entry:', error);
      setMessage({ type: 'error', text: 'Fehler beim Hinzufügen' });
    } else {
      setMessage({ type: 'success', text: 'Eintrag hinzugefügt' });
      setShowAddEntry(false);
      setNewEntry({
        driver_id: '',
        vehicle: '',
        date: new Date().toISOString().split('T')[0],
        start_time: '',
        end_time: '',
        notes: ''
      });
      loadEntries();
    }
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry) return;

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

    if (error) {
      console.error('Error updating entry:', error);
      setMessage({ type: 'error', text: 'Fehler beim Aktualisieren' });
    } else {
      setMessage({ type: 'success', text: 'Eintrag aktualisiert' });
      setEditingEntry(null);
      loadEntries();
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Eintrag wirklich löschen?')) return;

    const { error } = await supabase
      .from('work_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting entry:', error);
      setMessage({ type: 'error', text: 'Fehler beim Löschen' });
    } else {
      setMessage({ type: 'success', text: 'Eintrag gelöscht' });
      loadEntries();
      if (activeTab === 'reports') loadTodayEntries();
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

  const handleBulkDelete = async () => {
    if (selectedEntries.size === 0) {
      setMessage({ type: 'error', text: 'Keine Einträge ausgewählt' });
      return;
    }

    if (!confirm(`${selectedEntries.size} Einträge wirklich löschen?`)) return;

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
    }
  };

  const handleBulkExportPDF = () => {
    if (selectedEntries.size === 0) {
      setMessage({ type: 'error', text: 'Keine Einträge ausgewählt' });
      return;
    }

    const selectedEntriesData = entries.filter(e => selectedEntries.has(e.id));
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('Ausgewählte Einträge', 14, 15);
    doc.setFontSize(10);
    doc.text(`Exportiert am: ${new Date().toLocaleDateString('de-DE')}`, 14, 22);

    const tableData = selectedEntriesData.map(entry => {
      const driver = (entry as any).drivers;
      const hours = calculateDuration(entry.start_time, entry.end_time);
      const overtime = Math.max(0, hours - STANDARD_HOURS);

      return [
        entry.date,
        driver?.driver_name || '-',
        driver?.driver_code || '-',
        entry.vehicle || '-',
        entry.start_time,
        entry.end_time,
        formatHours(hours),
        formatHours(overtime),
        entry.notes || '-'
      ];
    });

    autoTable(doc, {
      head: [['Datum', 'Fahrer', 'Code', 'Fahrzeug', 'Von', 'Bis', 'Stunden', 'Überstunden', 'Notiz']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 }
    });

    doc.save(`Eintraege_${new Date().toISOString().split('T')[0]}.pdf`);
    setMessage({ type: 'success', text: 'PDF exportiert' });
  };

  const handleBulkExportExcel = () => {
    if (selectedEntries.size === 0) {
      setMessage({ type: 'error', text: 'Keine Einträge ausgewählt' });
      return;
    }

    const selectedEntriesData = entries.filter(e => selectedEntries.has(e.id));

    const excelData = selectedEntriesData.map(entry => {
      const driver = (entry as any).drivers;
      const hours = calculateDuration(entry.start_time, entry.end_time);
      const overtime = Math.max(0, hours - STANDARD_HOURS);

      return {
        'Datum': entry.date,
        'Fahrer': driver?.driver_name || '-',
        'Code': driver?.driver_code || '-',
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
    XLSX.utils.book_append_sheet(wb, ws, 'Einträge');
    XLSX.writeFile(wb, `Eintraege_${new Date().toISOString().split('T')[0]}.xlsx`);
    setMessage({ type: 'success', text: 'Excel exportiert' });
  };

  const loadTodayEntries = async () => {
    setLoadingToday(true);
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('work_entries')
      .select(`
        *,
        drivers (driver_code, driver_name)
      `)
      .eq('date', today)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error loading today entries:', error);
      setMessage({ type: 'error', text: 'Fehler beim Laden der heutigen Einträge' });
      setTodayEntries([]);
    } else {
      setTodayEntries(data || []);
    }
    setLoadingToday(false);
  };

  const handleGenerateMonthlyReport = async () => {
    if (!monthlyDriver) {
      setMessage({ type: 'error', text: 'Bitte Fahrer auswählen' });
      return;
    }

    const startDate = `${monthlyYear}-${String(monthlyMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(monthlyYear, monthlyMonth, 0).getDate();
    const endDate = `${monthlyYear}-${String(monthlyMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const { data: driver } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', monthlyDriver)
      .single();

    const { data: entries } = await supabase
      .from('work_entries')
      .select('*')
      .eq('driver_id', monthlyDriver)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (!driver) {
      setMessage({ type: 'error', text: 'Fahrer nicht gefunden' });
      return;
    }

    if (!entries) {
      setMessage({ type: 'error', text: 'Fehler beim Laden der Einträge' });
      return;
    }

    const summary = calculateSummary(entries);
    setMonthlyReport({ driver, entries, summary });
  };

  const handleGenerateCustomReport = async () => {
    if (!customDriver || !customDateFrom || !customDateTo) {
      setMessage({ type: 'error', text: 'Bitte alle Felder ausfüllen' });
      return;
    }

    const { data: driver } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', customDriver)
      .single();

    const { data: entries } = await supabase
      .from('work_entries')
      .select('*')
      .eq('driver_id', customDriver)
      .gte('date', customDateFrom)
      .lte('date', customDateTo)
      .order('date', { ascending: true });

    if (!driver) {
      setMessage({ type: 'error', text: 'Fahrer nicht gefunden' });
      return;
    }

    if (!entries) {
      setMessage({ type: 'error', text: 'Fehler beim Laden der Einträge' });
      return;
    }

    const summary = calculateSummary(entries);
    setCustomReport({ driver, entries, summary });
  };

  const handleCompareDrivers = async () => {
    if (!compareDriver1 || !compareDriver2) {
      setMessage({ type: 'error', text: 'Bitte beide Fahrer auswählen' });
      return;
    }

    const { from, to } = getDateRange(comparePeriod);

    const results = await Promise.all([compareDriver1, compareDriver2].map(async (driverId) => {
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
    }
  };

  const exportPDF = (driver: Driver, entries: WorkEntry[], summary: ReportSummary, dateFrom: string, dateTo: string) => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Fahrerabrechnung', 14, 20);

    doc.setFontSize(11);
    doc.text(`Fahrer Name: ${driver.driver_name}`, 14, 35);
    doc.text(`Fahrer Code: ${driver.driver_code}`, 14, 42);
    doc.text(`Zeitraum: ${dateFrom} bis ${dateTo}`, 14, 49);

    doc.setFontSize(10);
    doc.text(`Arbeitstage: ${summary.arbeitstage}`, 14, 60);
    doc.text(`Gesamtarbeitszeit: ${summary.gesamtarbeitszeit}`, 14, 67);
    doc.text(`Überstunden: ${summary.uberstunden}`, 14, 74);

    const tableData = entries.map(e => {
      const duration = calculateDuration(e.start_time, e.end_time);
      const overtime = Math.max(0, duration - STANDARD_HOURS);
      return [
        e.date,
        e.vehicle || '-',
        e.start_time,
        e.end_time,
        formatHours(duration),
        formatHours(overtime)
      ];
    });

    autoTable(doc, {
      startY: 82,
      head: [['Datum', 'Fahrzeug', 'Von', 'Bis', 'Arbeitszeit', 'Überstunden']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66] as any },
      styles: { fontSize: 9 }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 82;
    doc.setFontSize(9);
    doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 14, finalY + 10);

    const fromDate = new Date(dateFrom);
    const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const monthName = monthNames[fromDate.getMonth()];
    const year = fromDate.getFullYear();
    const cleanName = driver.driver_name.replace(/[^a-zA-Z0-9äöüÄÖÜß\s]/g, '').replace(/\s+/g, '_');

    doc.save(`${cleanName}_${monthName}_${year}.pdf`);
  };

  const exportExcel = (driver: Driver, entries: WorkEntry[], summary: ReportSummary, dateFrom: string, dateTo: string) => {
    const data = [
      ['Fahrerabrechnung'],
      [],
      ['Fahrer Name:', driver.driver_name],
      ['Fahrer Code:', driver.driver_code],
      ['Zeitraum:', `${dateFrom} bis ${dateTo}`],
      [],
      ['Arbeitstage:', summary.arbeitstage],
      ['Gesamtarbeitszeit:', summary.gesamtarbeitszeit],
      ['Überstunden:', summary.uberstunden],
      [],
      ['Datum', 'Fahrzeug', 'Von', 'Bis', 'Arbeitszeit', 'Überstunden'],
      ...entries.map(e => {
        const duration = calculateDuration(e.start_time, e.end_time);
        const overtime = Math.max(0, duration - STANDARD_HOURS);
        return [
          e.date,
          e.vehicle || '-',
          e.start_time,
          e.end_time,
          formatHours(duration),
          formatHours(overtime)
        ];
      })
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bericht');

    const fromDate = new Date(dateFrom);
    const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const monthName = monthNames[fromDate.getMonth()];
    const year = fromDate.getFullYear();
    const cleanName = driver.driver_name.replace(/[^a-zA-Z0-9äöüÄÖÜß\s]/g, '').replace(/\s+/g, '_');

    XLSX.writeFile(wb, `${cleanName}_${monthName}_${year}.xlsx`);
  };

  const getDriverSuggestions = (searchTerm: string) => {
    if (!searchTerm.trim()) return [];
    return drivers.filter(d =>
      d.driver_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.driver_name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim()) {
      setMessage({ type: 'error', text: 'Bitte neues Passwort eingeben' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwörter stimmen nicht überein' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Passwort muss mindestens 6 Zeichen lang sein' });
      return;
    }

    setChangingPassword(true);

    const adminId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    const { data: existing } = await supabase
      .from('admin_settings')
      .select('id')
      .eq('id', adminId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('admin_settings')
        .update({ password: newPassword, updated_at: new Date().toISOString() })
        .eq('id', adminId);

      if (error) {
        console.error('Error updating password:', error);
        setMessage({ type: 'error', text: 'Fehler beim Aktualisieren des Passworts' });
      } else {
        setMessage({ type: 'success', text: 'Passwort erfolgreich geändert' });
        setNewPassword('');
        setConfirmPassword('');
      }
    } else {
      const { error } = await supabase
        .from('admin_settings')
        .insert({ id: adminId, password: newPassword });

      if (error) {
        console.error('Error creating password:', error);
        setMessage({ type: 'error', text: 'Fehler beim Erstellen des Passworts' });
      } else {
        setMessage({ type: 'success', text: 'Passwort erfolgreich erstellt' });
        setNewPassword('');
        setConfirmPassword('');
      }
    }

    setChangingPassword(false);
  };

  const normalizeVehicle = (vehicle: string): string => {
    return vehicle.replace(/[\s-]/g, '').toUpperCase();
  };

  const handleVehicleLookup = async () => {
    if (!vehicleLookup.trim() || !vehicleDate) {
      setMessage({ type: 'error', text: 'Bitte Fahrzeug und Datum eingeben' });
      return;
    }

    setLookingUpVehicle(true);
    setVehicleResult(null);

    const normalizedSearch = normalizeVehicle(vehicleLookup);

    const { data: allEntries } = await supabase
      .from('work_entries')
      .select(`
        *,
        drivers (*)
      `)
      .eq('date', vehicleDate);

    if (allEntries) {
      const match = allEntries.find(entry => {
        if (!entry.vehicle) return false;
        const normalizedVehicle = normalizeVehicle(entry.vehicle);
        return normalizedVehicle === normalizedSearch;
      });

      if (match && (match as any).drivers) {
        setVehicleResult({
          driver: (match as any).drivers,
          entry: match
        });
      } else {
        setMessage({ type: 'error', text: 'Kein Fahrer für dieses Fahrzeug an diesem Datum gefunden' });
      }
    }

    setLookingUpVehicle(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <button
            onClick={onLogout}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Abmelden"
            aria-label="Abmelden"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {message && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="flex space-x-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-2 px-4 py-3 font-medium transition-colors ${
              activeTab === 'dashboard'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center space-x-2 px-4 py-3 font-medium transition-colors ${
              activeTab === 'reports'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span>Berichte</span>
          </button>
          <button
            onClick={() => setActiveTab('entries')}
            className={`flex items-center space-x-2 px-4 py-3 font-medium transition-colors ${
              activeTab === 'entries'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span>Einträge</span>
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            className={`flex items-center space-x-2 px-4 py-3 font-medium transition-colors ${
              activeTab === 'drivers'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Fahrer</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center space-x-2 px-4 py-3 font-medium transition-colors ${
              activeTab === 'settings'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span>Einstellungen</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {loadingDashboard ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : dashboardStats ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Heute: Eingetragen</h3>
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Check className="w-5 h-5 text-green-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{dashboardStats.driversSubmittedToday}</p>
                    <p className="text-xs text-gray-500 mt-1">Fahrer</p>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Heute: Nicht eingetragen</h3>
                      <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                        <X className="w-5 h-5 text-amber-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{dashboardStats.driversNotSubmittedToday.length}</p>
                    <p className="text-xs text-gray-500 mt-1">Fahrer</p>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Gesamtstunden heute</h3>
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Clock className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{formatHours(dashboardStats.totalHoursToday)}</p>
                    <p className="text-xs text-gray-500 mt-1">Stunden</p>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Überstunden heute</h3>
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <Plus className="w-5 h-5 text-purple-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{formatHours(dashboardStats.overtimeToday)}</p>
                    <p className="text-xs text-gray-500 mt-1">Stunden</p>
                  </div>
                </div>

                {dashboardStats.driversNotSubmittedToday.length > 0 && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Fahrer ohne Eintrag heute</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {dashboardStats.driversNotSubmittedToday.map(driver => (
                        <div key={driver.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-gray-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{driver.driver_name || 'Unbekannt'}</p>
                            <p className="text-xs text-gray-500">{driver.driver_code}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500">Keine Daten verfügbar</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'drivers' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Fahrzeug-Suche (Verkehrsstrafen)</h2>
              <p className="text-sm text-gray-600 mb-4">Finden Sie schnell heraus, welcher Fahrer ein bestimmtes Fahrzeug an einem Tag genutzt hat.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fahrzeug</label>
                  <input
                    type="text"
                    value={vehicleLookup}
                    onChange={(e) => setVehicleLookup(e.target.value)}
                    placeholder="z.B. MI299, MI 299, mi-299"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
                  <input
                    type="date"
                    value={vehicleDate}
                    onChange={(e) => setVehicleDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleVehicleLookup}
                    disabled={lookingUpVehicle}
                    className="w-full p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    title="Suchen"
                    aria-label="Fahrzeug suchen"
                  >
                    <Search className="w-5 h-5 mx-auto" />
                  </button>
                </div>
              </div>

              {vehicleResult && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="font-semibold text-green-900 mb-3">Gefunden:</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Fahrer:</span>
                      <span className="ml-2 font-medium text-gray-900">{vehicleResult.driver.driver_name} ({vehicleResult.driver.driver_code})</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Fahrzeug:</span>
                      <span className="ml-2 font-medium text-gray-900">{vehicleResult.entry.vehicle}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Datum:</span>
                      <span className="ml-2 font-medium text-gray-900">{vehicleResult.entry.date}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Arbeitszeit:</span>
                      <span className="ml-2 font-medium text-gray-900">{vehicleResult.entry.start_time} - {vehicleResult.entry.end_time}</span>
                    </div>
                    {vehicleResult.entry.notes && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Notiz:</span>
                        <span className="ml-2 font-medium text-gray-900">{vehicleResult.entry.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Neuer Fahrer</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Code"
                  value={newDriverCode}
                  onChange={(e) => setNewDriverCode(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="Name"
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleAddDriver}
                  className="p-2 text-2xl bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  title="Fahrer hinzufügen"
                  aria-label="Fahrer hinzufügen"
                >
                  ➕
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Code oder Name suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredDrivers.map(driver => (
                      <tr key={driver.id} className="hover:bg-gray-50">
                        {editingDriver?.id === driver.id ? (
                          <>
                            <td className="px-6 py-4">
                              <input
                                type="text"
                                value={editingDriver.driver_code}
                                onChange={(e) => setEditingDriver({ ...editingDriver, driver_code: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <input
                                type="text"
                                value={editingDriver.driver_name}
                                onChange={(e) => setEditingDriver({ ...editingDriver, driver_name: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                driver.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {driver.is_active ? 'Aktiv' : 'Inaktiv'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={handleUpdateDriver}
                                  className="p-2 text-xl hover:bg-green-50 rounded-lg"
                                  title="Speichern"
                                  aria-label="Speichern"
                                >
                                  💾
                                </button>
                                <button
                                  onClick={() => setEditingDriver(null)}
                                  className="p-2 text-xl hover:bg-gray-100 rounded-lg"
                                  title="Abbrechen"
                                  aria-label="Abbrechen"
                                >
                                  ❌
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{driver.driver_code}</td>
                            <td className="px-6 py-4 text-sm text-gray-900">{driver.driver_name}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                driver.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {driver.is_active ? 'Aktiv' : 'Inaktiv'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingDriver({
                                    id: driver.id,
                                    driver_code: driver.driver_code,
                                    driver_name: driver.driver_name
                                  })}
                                  className="p-2 text-xl hover:bg-blue-50 rounded-lg"
                                  title="Bearbeiten"
                                  aria-label="Bearbeiten"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleToggleActive(driver)}
                                  className="p-2 text-xl hover:bg-gray-100 rounded-lg"
                                  title={driver.is_active ? 'Deaktivieren' : 'Aktivieren'}
                                  aria-label={driver.is_active ? 'Deaktivieren' : 'Aktivieren'}
                                >
                                  {driver.is_active ? '🔴' : '🟢'}
                                </button>
                                <button
                                  onClick={() => handleDeleteDriver(driver.id)}
                                  className="p-2 text-xl hover:bg-red-50 rounded-lg"
                                  title="Löschen"
                                  aria-label="Löschen"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'entries' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filter
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Von Datum</label>
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bis Datum</label>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fahrer</label>
                  <select
                    value={filterDriverId}
                    onChange={(e) => setFilterDriverId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Alle</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.driver_code} - {d.driver_name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={loadEntries}
                    className="w-full p-2 text-2xl bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    title="Filter anwenden"
                    aria-label="Filter anwenden"
                  >
                    🔍
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowAddEntry(!showAddEntry)}
                className="p-2 text-2xl bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="Neuer Eintrag"
                aria-label="Neuer Eintrag"
              >
                ➕
              </button>
            </div>

            {showAddEntry && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Neuer Eintrag</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fahrer *</label>
                    <select
                      value={newEntry.driver_id}
                      onChange={(e) => setNewEntry({ ...newEntry, driver_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Auswählen</option>
                      {drivers.filter(d => d.is_active).map(d => (
                        <option key={d.id} value={d.id}>{d.driver_code} - {d.driver_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
                    <input
                      type="date"
                      value={newEntry.date}
                      onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Von Zeit *</label>
                    <input
                      type="time"
                      value={newEntry.start_time}
                      onChange={(e) => setNewEntry({ ...newEntry, start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bis Zeit *</label>
                    <input
                      type="time"
                      value={newEntry.end_time}
                      onChange={(e) => setNewEntry({ ...newEntry, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fahrzeug Kennzeichen</label>
                    <input
                      type="text"
                      value={newEntry.vehicle}
                      onChange={(e) => setNewEntry({ ...newEntry, vehicle: e.target.value })}
                      placeholder="z.B. B AB 1234"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
                    <input
                      type="text"
                      value={newEntry.notes}
                      onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {vehicleConflict && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-300 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                          <span className="text-lg">⚠️</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-amber-900 mb-1">Warnung: Fahrzeugkonflikt</h4>
                        <p className="text-sm text-amber-800 mb-2">
                          Dieses Fahrzeug wurde heute bereits von einem anderen Fahrer eingetragen.
                        </p>
                        {showConflictDetails && (
                          <div className="mt-3 p-3 bg-white rounded border border-amber-200">
                            <p className="text-sm text-gray-900 mb-1">
                              <strong>Fahrer:</strong> {vehicleConflict.driver.driver_name} ({vehicleConflict.driver.driver_code})
                            </p>
                            <p className="text-sm text-gray-900 mb-1">
                              <strong>Fahrzeug:</strong> {vehicleConflict.entry.vehicle}
                            </p>
                            <p className="text-sm text-gray-900">
                              <strong>Arbeitszeit:</strong> {vehicleConflict.entry.start_time} - {vehicleConflict.entry.end_time}
                            </p>
                          </div>
                        )}
                        <button
                          onClick={() => setShowConflictDetails(!showConflictDetails)}
                          className="mt-2 text-sm text-amber-700 hover:text-amber-900 underline"
                        >
                          {showConflictDetails ? 'Details ausblenden' : 'Details anzeigen'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleAddEntry}
                    className="p-2 text-2xl bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    title={vehicleConflict ? 'Trotzdem speichern' : 'Speichern'}
                    aria-label="Eintrag speichern"
                  >
                    💾
                  </button>
                  <button
                    onClick={() => {
                      setShowAddEntry(false);
                      setVehicleConflict(null);
                      setShowConflictDetails(false);
                      setNewEntry({
                        driver_id: '',
                        vehicle: '',
                        date: new Date().toISOString().split('T')[0],
                        start_time: '',
                        end_time: '',
                        notes: ''
                      });
                    }}
                    className="p-2 text-2xl bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    title="Abbrechen"
                    aria-label="Abbrechen"
                  >
                    ❌
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fahrer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fahrzeug</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Von</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bis</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dauer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notiz</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {entries.map(entry => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        {editingEntry?.id === entry.id ? (
                          <>
                            <td className="px-4 py-3">
                              <input
                                type="date"
                                value={editingEntry.date}
                                onChange={(e) => setEditingEntry({ ...editingEntry, date: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={editingEntry.driver_id}
                                onChange={(e) => setEditingEntry({ ...editingEntry, driver_id: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              >
                                {drivers.map(d => (
                                  <option key={d.id} value={d.id}>{d.driver_code}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={editingEntry.vehicle}
                                onChange={(e) => setEditingEntry({ ...editingEntry, vehicle: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="z.B. B AB 1234"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="time"
                                value={editingEntry.start_time}
                                onChange={(e) => setEditingEntry({ ...editingEntry, start_time: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="time"
                                value={editingEntry.end_time}
                                onChange={(e) => setEditingEntry({ ...editingEntry, end_time: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {formatHours(calculateDuration(editingEntry.start_time, editingEntry.end_time))}
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={editingEntry.notes}
                                onChange={(e) => setEditingEntry({ ...editingEntry, notes: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={handleUpdateEntry}
                                  className="p-2 text-xl hover:bg-green-50 rounded-lg"
                                  title="Speichern"
                                  aria-label="Speichern"
                                >
                                  💾
                                </button>
                                <button
                                  onClick={() => setEditingEntry(null)}
                                  className="p-2 text-xl hover:bg-gray-100 rounded-lg"
                                  title="Abbrechen"
                                  aria-label="Abbrechen"
                                >
                                  ❌
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-sm text-gray-900">{entry.date}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {(entry as any).drivers?.driver_code} - {(entry as any).drivers?.driver_name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{entry.vehicle || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{entry.start_time}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{entry.end_time}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {formatHours(calculateDuration(entry.start_time, entry.end_time))}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{entry.notes || '-'}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingEntry({
                                    id: entry.id,
                                    driver_id: entry.driver_id,
                                    vehicle: entry.vehicle || '',
                                    date: entry.date,
                                    start_time: entry.start_time,
                                    end_time: entry.end_time,
                                    notes: entry.notes || ''
                                  })}
                                  className="p-2 text-xl hover:bg-blue-50 rounded-lg"
                                  title="Bearbeiten"
                                  aria-label="Bearbeiten"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="p-2 text-xl hover:bg-red-50 rounded-lg"
                                  title="Löschen"
                                  aria-label="Löschen"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Heutige Einträge</h2>
                <button
                  onClick={loadTodayEntries}
                  disabled={loadingToday}
                  className="p-2 text-xl hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Aktualisieren"
                  aria-label="Aktualisieren"
                >
                  🔄
                </button>
              </div>
              {todayEntries.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Keine Einträge für heute</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fahrer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fahrzeug</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Von</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bis</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dauer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notiz</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {todayEntries.map(entry => (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{entry.date}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {(entry as any).drivers?.driver_code} - {(entry as any).drivers?.driver_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{entry.vehicle || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{entry.start_time}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{entry.end_time}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatHours(calculateDuration(entry.start_time, entry.end_time))}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{entry.notes || '-'}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setActiveTab('entries');
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
                                className="p-2 text-xl hover:bg-blue-50 rounded-lg"
                                title="Bearbeiten"
                                aria-label="Bearbeiten"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteEntry(entry.id)}
                                className="p-2 text-xl hover:bg-red-50 rounded-lg"
                                title="Löschen"
                                aria-label="Löschen"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Monatsbericht</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fahrer (Code oder Name)</label>
                  <input
                    type="text"
                    value={monthlyDriverSearch}
                    onChange={(e) => {
                      setMonthlyDriverSearch(e.target.value);
                      const suggestions = getDriverSuggestions(e.target.value);
                      if (suggestions.length === 1) {
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jahr</label>
                  <input
                    type="number"
                    value={monthlyYear}
                    onChange={(e) => setMonthlyYear(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monat</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={monthlyMonth}
                    onChange={(e) => setMonthlyMonth(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateMonthlyReport}
                  className="p-2 text-2xl bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  title="Bericht erstellen"
                  aria-label="Monatsbericht erstellen"
                >
                  📋
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
                      className="p-2 text-2xl bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      title="PDF exportieren"
                      aria-label="PDF exportieren"
                    >
                      📄
                    </button>
                    <button
                      onClick={() => {
                        const startDate = `${monthlyYear}-${String(monthlyMonth).padStart(2, '0')}-01`;
                        const lastDay = new Date(monthlyYear, monthlyMonth, 0).getDate();
                        const endDate = `${monthlyYear}-${String(monthlyMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                        exportExcel(monthlyReport.driver, monthlyReport.entries, monthlyReport.summary, startDate, endDate);
                      }}
                      className="p-2 text-2xl bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      title="Excel exportieren"
                      aria-label="Excel exportieren"
                    >
                      📊
                    </button>
                  </>
                )}
              </div>

              {monthlyReport && (
                <div className="mt-6 border-t pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="text-sm text-blue-600 font-medium">Arbeitstage</div>
                      <div className="text-2xl font-bold text-blue-900 mt-1">{monthlyReport.summary.arbeitstage}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="text-sm text-green-600 font-medium">Gesamtarbeitszeit</div>
                      <div className="text-2xl font-bold text-green-900 mt-1">{monthlyReport.summary.gesamtarbeitszeit}</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                      <div className="text-sm text-orange-600 font-medium">Überstunden</div>
                      <div className="text-2xl font-bold text-orange-900 mt-1">{monthlyReport.summary.uberstunden}</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fahrzeug</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Von</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bis</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Arbeitszeit</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Überstunden</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {monthlyReport.entries.map(entry => {
                          const duration = calculateDuration(entry.start_time, entry.end_time);
                          const overtime = Math.max(0, duration - STANDARD_HOURS);
                          return (
                            <tr key={entry.id}>
                              <td className="px-4 py-2">{entry.date}</td>
                              <td className="px-4 py-2">{entry.vehicle || '-'}</td>
                              <td className="px-4 py-2">{entry.start_time}</td>
                              <td className="px-4 py-2">{entry.end_time}</td>
                              <td className="px-4 py-2">{formatHours(duration)}</td>
                              <td className="px-4 py-2">{formatHours(overtime)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Zeitraum-Bericht</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fahrer (Code oder Name)</label>
                  <input
                    type="text"
                    value={customDriverSearch}
                    onChange={(e) => {
                      setCustomDriverSearch(e.target.value);
                      const suggestions = getDriverSuggestions(e.target.value);
                      if (suggestions.length === 1) {
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Von Datum</label>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bis Datum</label>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateCustomReport}
                  className="p-2 text-2xl bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  title="Bericht erstellen"
                  aria-label="Zeitraum-Bericht erstellen"
                >
                  📋
                </button>
                {customReport && (
                  <>
                    <button
                      onClick={() => exportPDF(customReport.driver, customReport.entries, customReport.summary, customDateFrom, customDateTo)}
                      className="p-2 text-2xl bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      title="PDF exportieren"
                      aria-label="PDF exportieren"
                    >
                      📄
                    </button>
                    <button
                      onClick={() => exportExcel(customReport.driver, customReport.entries, customReport.summary, customDateFrom, customDateTo)}
                      className="p-2 text-2xl bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      title="Excel exportieren"
                      aria-label="Excel exportieren"
                    >
                      📊
                    </button>
                  </>
                )}
              </div>

              {customReport && (
                <div className="mt-6 border-t pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="text-sm text-blue-600 font-medium">Arbeitstage</div>
                      <div className="text-2xl font-bold text-blue-900 mt-1">{customReport.summary.arbeitstage}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="text-sm text-green-600 font-medium">Gesamtarbeitszeit</div>
                      <div className="text-2xl font-bold text-green-900 mt-1">{customReport.summary.gesamtarbeitszeit}</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                      <div className="text-sm text-orange-600 font-medium">Überstunden</div>
                      <div className="text-2xl font-bold text-orange-900 mt-1">{customReport.summary.uberstunden}</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fahrzeug</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Von</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bis</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Arbeitszeit</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Überstunden</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {customReport.entries.map(entry => {
                          const duration = calculateDuration(entry.start_time, entry.end_time);
                          const overtime = Math.max(0, duration - STANDARD_HOURS);
                          return (
                            <tr key={entry.id}>
                              <td className="px-4 py-2">{entry.date}</td>
                              <td className="px-4 py-2">{entry.vehicle || '-'}</td>
                              <td className="px-4 py-2">{entry.start_time}</td>
                              <td className="px-4 py-2">{entry.end_time}</td>
                              <td className="px-4 py-2">{formatHours(duration)}</td>
                              <td className="px-4 py-2">{formatHours(overtime)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Fahrer vergleichen</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fahrer 1</label>
                  <input
                    type="text"
                    value={compareDriver1Search}
                    onChange={(e) => {
                      setCompareDriver1Search(e.target.value);
                      const suggestions = getDriverSuggestions(e.target.value);
                      if (suggestions.length === 1) {
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fahrer 2</label>
                  <input
                    type="text"
                    value={compareDriver2Search}
                    onChange={(e) => {
                      setCompareDriver2Search(e.target.value);
                      const suggestions = getDriverSuggestions(e.target.value);
                      if (suggestions.length === 1) {
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zeitraum</label>
                  <select
                    value={comparePeriod}
                    onChange={(e) => setComparePeriod(e.target.value as PeriodType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                className="p-2 text-2xl bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="Fahrer vergleichen"
                aria-label="Fahrer vergleichen"
              >
                ⚖️
              </button>

              {comparison && (
                <div className="mt-6 border-t pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">
                        {comparison.driver1.driver.driver_name} ({comparison.driver1.driver.driver_code})
                      </h3>
                      <div className="space-y-2">
                        <div className="bg-blue-50 rounded-lg p-3">
                          <div className="text-sm text-blue-600 font-medium">Arbeitstage</div>
                          <div className="text-xl font-bold text-blue-900">{comparison.driver1.summary.arbeitstage}</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3">
                          <div className="text-sm text-green-600 font-medium">Gesamtarbeitszeit</div>
                          <div className="text-xl font-bold text-green-900">{comparison.driver1.summary.gesamtarbeitszeit}</div>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-3">
                          <div className="text-sm text-orange-600 font-medium">Überstunden</div>
                          <div className="text-xl font-bold text-orange-900">{comparison.driver1.summary.uberstunden}</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">
                        {comparison.driver2.driver.driver_name} ({comparison.driver2.driver.driver_code})
                      </h3>
                      <div className="space-y-2">
                        <div className="bg-blue-50 rounded-lg p-3">
                          <div className="text-sm text-blue-600 font-medium">Arbeitstage</div>
                          <div className="text-xl font-bold text-blue-900">{comparison.driver2.summary.arbeitstage}</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3">
                          <div className="text-sm text-green-600 font-medium">Gesamtarbeitszeit</div>
                          <div className="text-xl font-bold text-green-900">{comparison.driver2.summary.gesamtarbeitszeit}</div>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-3">
                          <div className="text-sm text-orange-600 font-medium">Überstunden</div>
                          <div className="text-xl font-bold text-orange-900">{comparison.driver2.summary.uberstunden}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Vergleich</h4>
                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="text-gray-600">Unterschied Gesamtzeit: </span>
                        <span className="font-medium text-gray-900">
                          {formatHours(Math.abs(comparison.driver1.summary.totalHours - comparison.driver2.summary.totalHours))}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Unterschied Überstunden: </span>
                        <span className="font-medium text-gray-900">
                          {formatHours(Math.abs(comparison.driver1.summary.overtimeHours - comparison.driver2.summary.overtimeHours))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Admin-Passwort ändern</h2>
              <div className="max-w-md space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Neues Passwort</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mindestens 6 Zeichen"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Passwort bestätigen</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Passwort wiederholen"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="p-2 text-2xl bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={changingPassword ? 'Wird geändert...' : 'Passwort ändern'}
                  aria-label="Passwort ändern"
                >
                  💾
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
