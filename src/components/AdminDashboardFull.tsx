import React, { useState, useEffect } from 'react';
import { supabase, Driver, WorkEntry } from '../lib/supabase';
import {
  Users, FileText, BarChart3, Plus, Pencil, Trash2,
  Check, X, Search, Download, Calendar, LogOut,
  Power, PowerOff, Filter, ChevronDown
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  vehicle_letters: string;
  vehicle_numbers: string;
  work_date: string;
  from_time: string;
  to_time: string;
  notiz: string;
}

interface DriverWithEntries extends Driver {
  work_entries: WorkEntry[];
}

interface ComparisonResult {
  driver: Driver;
  arbeitstage: number;
  gesamtarbeitszeit: string;
  uberstunden: string;
}

export default function AdminDashboardFull({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>('drivers');
  const [message, setMessage] = useState<Message | null>(null);

  // Tab 1: Drivers
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [newDriverCode, setNewDriverCode] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
  const [editingDriver, setEditingDriver] = useState<EditingDriver | null>(null);

  // Tab 2: Entries
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterDriverId, setFilterDriverId] = useState('');
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({
    driver_id: '',
    vehicle_letters: '',
    vehicle_numbers: '',
    work_date: new Date().toISOString().split('T')[0],
    from_time: '',
    to_time: '',
    notiz: ''
  });
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);

  // Tab 3: Reports
  const [todayEntries, setTodayEntries] = useState<WorkEntry[]>([]);
  const [compareDriver1, setCompareDriver1] = useState('');
  const [compareDriver2, setCompareDriver2] = useState('');
  const [compareYear, setCompareYear] = useState(new Date().getFullYear());
  const [compareMonth, setCompareMonth] = useState(new Date().getMonth() + 1);
  const [comparison, setComparison] = useState<{ driver1: ComparisonResult | null, driver2: ComparisonResult | null } | null>(null);
  const [reportDriver, setReportDriver] = useState('');
  const [reportPeriod, setReportPeriod] = useState<'last_month' | 'this_month' | 'custom'>('this_month');
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [reportData, setReportData] = useState<{ driver: Driver, entries: WorkEntry[], totals: any } | null>(null);

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

  // ==================== TAB 1: DRIVERS ====================

  const loadDrivers = async () => {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
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

  // ==================== TAB 2: ENTRIES ====================

  const loadEntries = async () => {
    let query = supabase
      .from('work_entries')
      .select(`
        *,
        drivers (driver_code, driver_name)
      `)
      .order('work_date', { ascending: false });

    if (filterDateFrom) query = query.gte('work_date', filterDateFrom);
    if (filterDateTo) query = query.lte('work_date', filterDateTo);
    if (filterDriverId) query = query.eq('driver_id', filterDriverId);

    const { data, error } = await query;

    if (error) {
      setMessage({ type: 'error', text: 'Fehler beim Laden der Einträge' });
    } else {
      setEntries(data || []);
    }
  };

  const handleAddEntry = async () => {
    if (!newEntry.driver_id || !newEntry.from_time || !newEntry.to_time) {
      setMessage({ type: 'error', text: 'Bitte alle Pflichtfelder ausfüllen' });
      return;
    }

    // Check if entry already exists for this driver on this date
    const { data: existing } = await supabase
      .from('work_entries')
      .select('id')
      .eq('driver_id', newEntry.driver_id)
      .eq('work_date', newEntry.work_date);

    if (existing && existing.length > 0) {
      setMessage({ type: 'error', text: 'Für diesen Tag existiert bereits ein Eintrag' });
      return;
    }

    const { error } = await supabase
      .from('work_entries')
      .insert({
        driver_id: newEntry.driver_id,
        vehicle_letters: newEntry.vehicle_letters || null,
        vehicle_numbers: newEntry.vehicle_numbers || null,
        work_date: newEntry.work_date,
        from_time: newEntry.from_time,
        to_time: newEntry.to_time,
        notiz: newEntry.notiz || null
      });

    if (error) {
      setMessage({ type: 'error', text: 'Fehler beim Hinzufügen' });
    } else {
      setMessage({ type: 'success', text: 'Eintrag hinzugefügt' });
      setShowAddEntry(false);
      setNewEntry({
        driver_id: '',
        vehicle_letters: '',
        vehicle_numbers: '',
        work_date: new Date().toISOString().split('T')[0],
        from_time: '',
        to_time: '',
        notiz: ''
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
        vehicle_letters: editingEntry.vehicle_letters || null,
        vehicle_numbers: editingEntry.vehicle_numbers || null,
        work_date: editingEntry.work_date,
        from_time: editingEntry.from_time,
        to_time: editingEntry.to_time,
        notiz: editingEntry.notiz || null
      })
      .eq('id', editingEntry.id);

    if (error) {
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
      setMessage({ type: 'error', text: 'Fehler beim Löschen' });
    } else {
      setMessage({ type: 'success', text: 'Eintrag gelöscht' });
      loadEntries();
      if (activeTab === 'reports') loadTodayEntries();
    }
  };

  // ==================== TAB 3: REPORTS ====================

  const loadTodayEntries = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('work_entries')
      .select(`
        *,
        drivers (driver_code, driver_name)
      `)
      .eq('work_date', today)
      .order('from_time', { ascending: true });

    if (error) {
      setMessage({ type: 'error', text: 'Fehler beim Laden' });
    } else {
      setTodayEntries(data || []);
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
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const handleCompareDrivers = async () => {
    if (!compareDriver1 || !compareDriver2) {
      setMessage({ type: 'error', text: 'Bitte beide Fahrer auswählen' });
      return;
    }

    const startDate = `${compareYear}-${String(compareMonth).padStart(2, '0')}-01`;
    const endDate = new Date(compareYear, compareMonth, 0).toISOString().split('T')[0];

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
        .gte('work_date', startDate)
        .lte('work_date', endDate);

      if (!driver || !entries) return null;

      const arbeitstage = new Set(entries.map(e => e.work_date)).size;
      const totalHours = entries.reduce((sum, e) => sum + calculateDuration(e.from_time, e.to_time), 0);
      const overtime = entries.reduce((sum, e) => {
        const daily = calculateDuration(e.from_time, e.to_time);
        return sum + Math.max(0, daily - 8);
      }, 0);

      return {
        driver,
        arbeitstage,
        gesamtarbeitszeit: formatHours(totalHours),
        uberstunden: formatHours(overtime)
      };
    }));

    setComparison({
      driver1: results[0],
      driver2: results[1]
    });
  };

  const handleGenerateReport = async () => {
    if (!reportDriver) {
      setMessage({ type: 'error', text: 'Bitte Fahrer auswählen' });
      return;
    }

    let dateFrom = reportDateFrom;
    let dateTo = reportDateTo;

    if (reportPeriod === 'last_month') {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      dateFrom = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString().split('T')[0];
      dateTo = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString().split('T')[0];
    } else if (reportPeriod === 'this_month') {
      const now = new Date();
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      dateTo = now.toISOString().split('T')[0];
    }

    if (!dateFrom || !dateTo) {
      setMessage({ type: 'error', text: 'Bitte Zeitraum auswählen' });
      return;
    }

    const { data: driver } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', reportDriver)
      .single();

    const { data: entries } = await supabase
      .from('work_entries')
      .select('*')
      .eq('driver_id', reportDriver)
      .gte('work_date', dateFrom)
      .lte('work_date', dateTo)
      .order('work_date', { ascending: true });

    if (!driver || !entries) {
      setMessage({ type: 'error', text: 'Fehler beim Laden' });
      return;
    }

    const arbeitstage = new Set(entries.map(e => e.work_date)).size;
    const totalHours = entries.reduce((sum, e) => sum + calculateDuration(e.from_time, e.to_time), 0);
    const overtime = entries.reduce((sum, e) => {
      const daily = calculateDuration(e.from_time, e.to_time);
      return sum + Math.max(0, daily - 8);
    }, 0);

    setReportData({
      driver,
      entries,
      totals: {
        dateFrom,
        dateTo,
        arbeitstage,
        gesamtarbeitszeit: formatHours(totalHours),
        uberstunden: formatHours(overtime)
      }
    });
  };

  const handleExportPDF = () => {
    if (!reportData) return;

    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text('Fahrerabrechnung', 14, 20);

    // Driver info
    doc.setFontSize(12);
    doc.text(`Fahrer: ${reportData.driver.driver_name} (${reportData.driver.driver_code})`, 14, 30);
    doc.text(`Zeitraum: ${reportData.totals.dateFrom} bis ${reportData.totals.dateTo}`, 14, 37);

    // Entries table
    const tableData = reportData.entries.map(e => [
      e.work_date,
      `${e.vehicle_letters || ''} ${e.vehicle_numbers || ''}`.trim() || '-',
      e.from_time,
      e.to_time,
      formatHours(calculateDuration(e.from_time, e.to_time)),
      e.notiz || '-'
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Datum', 'Fahrzeug', 'Von', 'Bis', 'Dauer', 'Notiz']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66] as any },
      styles: { fontSize: 9 }
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY || 45;
    doc.setFontSize(11);
    doc.text(`Arbeitstage: ${reportData.totals.arbeitstage}`, 14, finalY + 10);
    doc.text(`Gesamtarbeitszeit: ${reportData.totals.gesamtarbeitszeit}`, 14, finalY + 17);
    doc.text(`Ueberstunden: ${reportData.totals.uberstunden}`, 14, finalY + 24);

    doc.save(`Fahrerabrechnung_${reportData.driver.driver_code}_${reportData.totals.dateFrom}_${reportData.totals.dateTo}.pdf`);
  };

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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

      {/* Message */}
      {message && (
        <div className={`max-w-7xl mx-auto px-4 mt-4`}>
          <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </div>
        </div>
      )}

      {/* Tabs */}
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

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* TAB 1: DRIVERS */}
        {activeTab === 'drivers' && (
          <div className="space-y-6">
            {/* Add Driver */}
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

            {/* Search */}
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

            {/* Drivers List */}
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

        {/* TAB 2: ENTRIES */}
        {activeTab === 'entries' && (
          <div className="space-y-6">
            {/* Filters */}
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

            {/* Add Entry Button */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowAddEntry(!showAddEntry)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Neuer Eintrag
              </button>
            </div>

            {/* Add Entry Form */}
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
                      value={newEntry.work_date}
                      onChange={(e) => setNewEntry({ ...newEntry, work_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Von Zeit *</label>
                    <input
                      type="time"
                      value={newEntry.from_time}
                      onChange={(e) => setNewEntry({ ...newEntry, from_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bis Zeit *</label>
                    <input
                      type="time"
                      value={newEntry.to_time}
                      onChange={(e) => setNewEntry({ ...newEntry, to_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kennzeichen Buchstaben</label>
                    <input
                      type="text"
                      value={newEntry.vehicle_letters}
                      onChange={(e) => setNewEntry({ ...newEntry, vehicle_letters: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kennzeichen Zahlen</label>
                    <input
                      type="text"
                      value={newEntry.vehicle_numbers}
                      onChange={(e) => setNewEntry({ ...newEntry, vehicle_numbers: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
                    <input
                      type="text"
                      value={newEntry.notiz}
                      onChange={(e) => setNewEntry({ ...newEntry, notiz: e.target.value })}
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
                        vehicle_letters: '',
                        vehicle_numbers: '',
                        work_date: new Date().toISOString().split('T')[0],
                        from_time: '',
                        to_time: '',
                        notiz: ''
                      });
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* Entries List */}
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
                                value={editingEntry.work_date}
                                onChange={(e) => setEditingEntry({ ...editingEntry, work_date: e.target.value })}
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
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  value={editingEntry.vehicle_letters}
                                  onChange={(e) => setEditingEntry({ ...editingEntry, vehicle_letters: e.target.value })}
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                                  placeholder="XX"
                                />
                                <input
                                  type="text"
                                  value={editingEntry.vehicle_numbers}
                                  onChange={(e) => setEditingEntry({ ...editingEntry, vehicle_numbers: e.target.value })}
                                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                                  placeholder="1234"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="time"
                                value={editingEntry.from_time}
                                onChange={(e) => setEditingEntry({ ...editingEntry, from_time: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="time"
                                value={editingEntry.to_time}
                                onChange={(e) => setEditingEntry({ ...editingEntry, to_time: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {formatHours(calculateDuration(editingEntry.from_time, editingEntry.to_time))}
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={editingEntry.notiz}
                                onChange={(e) => setEditingEntry({ ...editingEntry, notiz: e.target.value })}
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
                            <td className="px-4 py-3 text-sm text-gray-900">{entry.work_date}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {(entry as any).drivers?.driver_code} - {(entry as any).drivers?.driver_name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {entry.vehicle_letters && entry.vehicle_numbers
                                ? `${entry.vehicle_letters} ${entry.vehicle_numbers}`
                                : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{entry.from_time}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{entry.to_time}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {formatHours(calculateDuration(entry.from_time, entry.to_time))}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{entry.notiz || '-'}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingEntry({
                                    id: entry.id,
                                    driver_id: entry.driver_id,
                                    vehicle_letters: entry.vehicle_letters || '',
                                    vehicle_numbers: entry.vehicle_numbers || '',
                                    work_date: entry.work_date,
                                    from_time: entry.from_time,
                                    to_time: entry.to_time,
                                    notiz: entry.notiz || ''
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

        {/* TAB 3: REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* Block 1: Today's Entries */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Heutige Einträge</h2>
              {todayEntries.length === 0 ? (
                <p className="text-gray-500">Keine Einträge für heute</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
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
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {(entry as any).drivers?.driver_code} - {(entry as any).drivers?.driver_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {entry.vehicle_letters && entry.vehicle_numbers
                              ? `${entry.vehicle_letters} ${entry.vehicle_numbers}`
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{entry.from_time}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{entry.to_time}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatHours(calculateDuration(entry.from_time, entry.to_time))}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{entry.notiz || '-'}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setActiveTab('entries');
                                  setEditingEntry({
                                    id: entry.id,
                                    driver_id: entry.driver_id,
                                    vehicle_letters: entry.vehicle_letters || '',
                                    vehicle_numbers: entry.vehicle_numbers || '',
                                    work_date: entry.work_date,
                                    from_time: entry.from_time,
                                    to_time: entry.to_time,
                                    notiz: entry.notiz || ''
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

            {/* Block 2: Compare Drivers */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Fahrer vergleichen</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fahrer 1</label>
                  <select
                    value={compareDriver1}
                    onChange={(e) => setCompareDriver1(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Auswählen</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.driver_code} - {d.driver_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fahrer 2</label>
                  <select
                    value={compareDriver2}
                    onChange={(e) => setCompareDriver2(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Auswählen</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.driver_code} - {d.driver_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jahr</label>
                  <input
                    type="number"
                    value={compareYear}
                    onChange={(e) => setCompareYear(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monat</label>
                  <select
                    value={compareMonth}
                    onChange={(e) => setCompareMonth(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {[comparison.driver1, comparison.driver2].map((result, idx) => result && (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3">
                        {result.driver.driver_name} ({result.driver.driver_code})
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Arbeitstage:</span>
                          <span className="font-medium text-gray-900">{result.arbeitstage}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Gesamtarbeitszeit:</span>
                          <span className="font-medium text-gray-900">{result.gesamtarbeitszeit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Überstunden:</span>
                          <span className="font-medium text-gray-900">{result.uberstunden}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Block 3: Driver Report */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Fahrerabrechnung erstellen</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fahrer</label>
                  <select
                    value={reportDriver}
                    onChange={(e) => setReportDriver(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Auswählen</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.driver_code} - {d.driver_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zeitraum</label>
                  <select
                    value={reportPeriod}
                    onChange={(e) => setReportPeriod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="last_month">Letzter Monat</option>
                    <option value="this_month">Dieser Monat</option>
                    <option value="custom">Benutzerdefiniert</option>
                  </select>
                </div>
              </div>

              {reportPeriod === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Von</label>
                    <input
                      type="date"
                      value={reportDateFrom}
                      onChange={(e) => setReportDateFrom(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bis</label>
                    <input
                      type="date"
                      value={reportDateTo}
                      onChange={(e) => setReportDateTo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerateReport}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Bericht erstellen
              </button>

              {reportData && (
                <div className="mt-6 border-t pt-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {reportData.driver.driver_name} ({reportData.driver.driver_code})
                      </h3>
                      <p className="text-sm text-gray-600">
                        {reportData.totals.dateFrom} bis {reportData.totals.dateTo}
                      </p>
                    </div>
                    <button
                      onClick={handleExportPDF}
                      className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      title="PDF exportieren"
                      aria-label="PDF exportieren"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fahrzeug</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Von</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bis</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dauer</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notiz</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {reportData.entries.map(entry => (
                          <tr key={entry.id}>
                            <td className="px-4 py-2">{entry.work_date}</td>
                            <td className="px-4 py-2">
                              {entry.vehicle_letters && entry.vehicle_numbers
                                ? `${entry.vehicle_letters} ${entry.vehicle_numbers}`
                                : '-'}
                            </td>
                            <td className="px-4 py-2">{entry.from_time}</td>
                            <td className="px-4 py-2">{entry.to_time}</td>
                            <td className="px-4 py-2">
                              {formatHours(calculateDuration(entry.from_time, entry.to_time))}
                            </td>
                            <td className="px-4 py-2">{entry.notiz || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Zusammenfassung</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Arbeitstage:</span>
                        <p className="font-medium text-gray-900 text-lg">{reportData.totals.arbeitstage}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Gesamtarbeitszeit:</span>
                        <p className="font-medium text-gray-900 text-lg">{reportData.totals.gesamtarbeitszeit}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Überstunden:</span>
                        <p className="font-medium text-gray-900 text-lg">{reportData.totals.uberstunden}</p>
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
