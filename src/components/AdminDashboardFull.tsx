import React, { useState, useEffect } from 'react';
import { supabase, Driver, WorkEntry } from '../lib/supabase';
import {
  Users, FileText, BarChart3, Plus, Pencil, Trash2,
  Check, X, Search, Download, LogOut,
  Power, PowerOff, Filter, RefreshCw, FileSpreadsheet
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Message {
  type: 'success' | 'error';
  text: string;
}

type TabType = 'drivers' | 'entries' | 'reports';

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

export default function AdminDashboardFull({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>('drivers');
  const [message, setMessage] = useState<Message | null>(null);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [newDriverCode, setNewDriverCode] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
  const [editingDriver, setEditingDriver] = useState<EditingDriver | null>(null);

  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterDriverId, setFilterDriverId] = useState('');
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
    if (activeTab === 'drivers') loadDrivers();
    if (activeTab === 'entries') loadEntries();
    if (activeTab === 'reports') loadTodayEntries();
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

  const handleAddEntry = async () => {
    if (!newEntry.driver_id || !newEntry.start_time || !newEntry.end_time) {
      setMessage({ type: 'error', text: 'Bitte alle Pflichtfelder ausfüllen' });
      return;
    }

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

    doc.save(`Fahrerabrechnung_${driver.driver_code}_${dateFrom}_${dateTo}.pdf`);
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
    XLSX.writeFile(wb, `Fahrerabrechnung_${driver.driver_code}_${dateFrom}_${dateTo}.xlsx`);
  };

  const getDriverSuggestions = (searchTerm: string) => {
    if (!searchTerm.trim()) return [];
    return drivers.filter(d =>
      d.driver_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.driver_name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);
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
            onClick={() => setActiveTab('reports')}
            className={`flex items-center space-x-2 px-4 py-3 font-medium transition-colors ${
              activeTab === 'reports'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span>Berichte</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'drivers' && (
          <div className="space-y-6">
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
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  title="Hinzufügen"
                  aria-label="Fahrer hinzufügen"
                >
                  <Plus className="w-5 h-5" />
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
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                  title="Speichern"
                                  aria-label="Speichern"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingDriver(null)}
                                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                  title="Abbrechen"
                                  aria-label="Abbrechen"
                                >
                                  <X className="w-4 h-4" />
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
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                  title="Bearbeiten"
                                  aria-label="Bearbeiten"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleToggleActive(driver)}
                                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                  title={driver.is_active ? 'Deaktivieren' : 'Aktivieren'}
                                  aria-label={driver.is_active ? 'Deaktivieren' : 'Aktivieren'}
                                >
                                  {driver.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteDriver(driver.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                  title="Löschen"
                                  aria-label="Löschen"
                                >
                                  <Trash2 className="w-4 h-4" />
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
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Anwenden
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowAddEntry(!showAddEntry)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Neuer Eintrag
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
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleAddEntry}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Speichern
                  </button>
                  <button
                    onClick={() => {
                      setShowAddEntry(false);
                      setNewEntry({
                        driver_id: '',
                        vehicle: '',
                        date: new Date().toISOString().split('T')[0],
                        start_time: '',
                        end_time: '',
                        notes: ''
                      });
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Abbrechen
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
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                  title="Speichern"
                                  aria-label="Speichern"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingEntry(null)}
                                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                  title="Abbrechen"
                                  aria-label="Abbrechen"
                                >
                                  <X className="w-4 h-4" />
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
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                  title="Bearbeiten"
                                  aria-label="Bearbeiten"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                  title="Löschen"
                                  aria-label="Löschen"
                                >
                                  <Trash2 className="w-4 h-4" />
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
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Aktualisieren"
                  aria-label="Aktualisieren"
                >
                  <RefreshCw className={`w-5 h-5 ${loadingToday ? 'animate-spin' : ''}`} />
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
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                title="Bearbeiten"
                                aria-label="Bearbeiten"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteEntry(entry.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                title="Löschen"
                                aria-label="Löschen"
                              >
                                <Trash2 className="w-4 h-4" />
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
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
                      className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      title="PDF exportieren"
                      aria-label="PDF exportieren"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        const startDate = `${monthlyYear}-${String(monthlyMonth).padStart(2, '0')}-01`;
                        const lastDay = new Date(monthlyYear, monthlyMonth, 0).getDate();
                        const endDate = `${monthlyYear}-${String(monthlyMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                        exportExcel(monthlyReport.driver, monthlyReport.entries, monthlyReport.summary, startDate, endDate);
                      }}
                      className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      title="Excel exportieren"
                      aria-label="Excel exportieren"
                    >
                      <FileSpreadsheet className="w-5 h-5" />
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Bericht erstellen
                </button>
                {customReport && (
                  <>
                    <button
                      onClick={() => exportPDF(customReport.driver, customReport.entries, customReport.summary, customDateFrom, customDateTo)}
                      className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      title="PDF exportieren"
                      aria-label="PDF exportieren"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => exportExcel(customReport.driver, customReport.entries, customReport.summary, customDateFrom, customDateTo)}
                      className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      title="Excel exportieren"
                      aria-label="Excel exportieren"
                    >
                      <FileSpreadsheet className="w-5 h-5" />
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Vergleichen
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
      </div>
    </div>
  );
}
