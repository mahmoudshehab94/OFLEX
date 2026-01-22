import { useState, useEffect } from 'react';
import {
  LogOut, Users, FileText, BarChart2, Plus, Edit2, Trash2, Save, X, Download
} from 'lucide-react';
import { supabase, Driver, WorkEntry, DriverWithWorkEntries, hasSupabaseConfig } from '../lib/supabase';
import jsPDF from 'jspdf';

interface AdminDashboardProps {
  onLogout: () => void;
}

type Tab = 'fahrer' | 'eintraege' | 'berichte';

const STANDARD_DAILY_HOURS = 8;

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('fahrer');
  const [drivers, setDrivers] = useState<DriverWithWorkEntries[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Driver management states
  const [newDriverCode, setNewDriverCode] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');

  // Entry management states
  const [manualDriverCode, setManualDriverCode] = useState('');
  const [manualVehicle, setManualVehicle] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualStartTime, setManualStartTime] = useState('');
  const [manualEndTime, setManualEndTime] = useState('');
  const [manualBreakMinutes, setManualBreakMinutes] = useState('0');
  const [manualNote, setManualNote] = useState('');
  const [allowMultipleEntries, setAllowMultipleEntries] = useState(false);

  // Entry filter states
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSearchType, setFilterSearchType] = useState<'vehicle' | 'driver'>('vehicle');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterDriverCode, setFilterDriverCode] = useState('');
  const [filteredEntries, setFilteredEntries] = useState<(WorkEntry & { driver?: Driver })[]>([]);

  // Report states
  const [reportDriverCode, setReportDriverCode] = useState('');
  const [reportYear, setReportYear] = useState(new Date().getFullYear().toString());
  const [reportMonth, setReportMonth] = useState((new Date().getMonth() + 1).toString());

  const [compareDriver1Code, setCompareDriver1Code] = useState('');
  const [compareDriver2Code, setCompareDriver2Code] = useState('');
  const [compareYear, setCompareYear] = useState(new Date().getFullYear().toString());
  const [compareMonth, setCompareMonth] = useState((new Date().getMonth() + 1).toString());

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    if (!supabase) {
      setMessage({ type: 'error', text: 'Datenbank nicht konfiguriert' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select(`
          *,
          work_entries (*)
        `)
        .order('driver_code', { ascending: true });

      if (error) {
        console.error('Load drivers error:', error);
        setMessage({ type: 'error', text: 'Interner Serverfehler beim Laden der Fahrer' });
      } else {
        setDrivers(data || []);
      }
    } catch (error: any) {
      console.error('Unexpected error:', error);
      setMessage({ type: 'error', text: 'Interner Serverfehler' });
    } finally {
      setLoading(false);
    }
  };

  const findDriver = (codeOrName: string): Driver | null => {
    if (!codeOrName.trim()) return null;
    const search = codeOrName.trim().toLowerCase();
    return drivers.find(d =>
      d.driver_code.toLowerCase() === search ||
      d.driver_name.toLowerCase() === search
    ) || null;
  };

  // ============ DRIVER MANAGEMENT ============

  const addDriver = async () => {
    if (!supabase) return;

    if (!newDriverCode.trim() || !newDriverName.trim()) {
      setMessage({ type: 'error', text: 'Bitte Code und Name eingeben' });
      return;
    }

    if (!/^\d+$/.test(newDriverCode.trim())) {
      setMessage({ type: 'error', text: 'Code muss eine Zahl sein' });
      return;
    }

    try {
      const { error } = await supabase
        .from('drivers')
        .insert({
          driver_code: newDriverCode.trim(),
          driver_name: newDriverName.trim(),
          is_active: true
        });

      if (error) {
        if (error.code === '23505') {
          setMessage({ type: 'error', text: 'Code bereits vergeben' });
        } else {
          setMessage({ type: 'error', text: `Fehler: ${error.message}` });
        }
      } else {
        setMessage({ type: 'success', text: 'Fahrer erfolgreich hinzugefügt' });
        setNewDriverCode('');
        setNewDriverName('');
        loadDrivers();
      }
    } catch (error: any) {
      console.error('Add driver error:', error);
      setMessage({ type: 'error', text: 'Fehler beim Hinzufügen' });
    }
  };

  const startEditDriver = (driver: Driver) => {
    setEditingDriver(driver);
    setEditCode(driver.driver_code);
    setEditName(driver.driver_name);
  };

  const cancelEdit = () => {
    setEditingDriver(null);
    setEditCode('');
    setEditName('');
  };

  const saveDriverEdit = async () => {
    if (!supabase || !editingDriver) return;

    if (!editCode.trim() || !editName.trim()) {
      setMessage({ type: 'error', text: 'Code und Name erforderlich' });
      return;
    }

    if (!/^\d+$/.test(editCode.trim())) {
      setMessage({ type: 'error', text: 'Code muss eine Zahl sein' });
      return;
    }

    try {
      const { error } = await supabase
        .from('drivers')
        .update({
          driver_code: editCode.trim(),
          driver_name: editName.trim()
        })
        .eq('id', editingDriver.id);

      if (error) {
        if (error.code === '23505') {
          setMessage({ type: 'error', text: 'Code bereits vergeben' });
        } else {
          setMessage({ type: 'error', text: `Fehler: ${error.message}` });
        }
      } else {
        setMessage({ type: 'success', text: 'Fahrer erfolgreich aktualisiert' });
        cancelEdit();
        loadDrivers();
      }
    } catch (error: any) {
      console.error('Update driver error:', error);
      setMessage({ type: 'error', text: 'Fehler beim Aktualisieren' });
    }
  };

  const deleteDriver = async (driverId: string) => {
    if (!supabase) return;
    if (!confirm('Fahrer wirklich löschen? Alle Einträge werden ebenfalls gelöscht.')) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', driverId);

      if (error) {
        setMessage({ type: 'error', text: `Fehler: ${error.message}` });
      } else {
        setMessage({ type: 'success', text: 'Fahrer erfolgreich gelöscht' });
        loadDrivers();
      }
    } catch (error: any) {
      console.error('Delete driver error:', error);
      setMessage({ type: 'error', text: 'Fehler beim Löschen' });
    }
  };

  // ============ ENTRY MANAGEMENT ============

  const addManualEntry = async () => {
    if (!supabase) return;

    const driver = findDriver(manualDriverCode);
    if (!driver) {
      setMessage({ type: 'error', text: 'Fahrer nicht gefunden' });
      return;
    }

    if (!manualVehicle || !manualStartTime || !manualEndTime) {
      setMessage({ type: 'error', text: 'Bitte alle Pflichtfelder ausfüllen' });
      return;
    }

    // Validate end time > start time
    if (manualEndTime <= manualStartTime) {
      setMessage({ type: 'error', text: 'Endzeit muss nach Startzeit liegen' });
      return;
    }

    const breakMins = parseInt(manualBreakMinutes) || 0;
    if (breakMins < 0) {
      setMessage({ type: 'error', text: 'Pause muss >= 0 sein' });
      return;
    }

    // Check for existing entry if override not checked
    if (!allowMultipleEntries) {
      const { data: existing } = await supabase
        .from('work_entries')
        .select('id')
        .eq('driver_id', driver.id)
        .eq('date', manualDate)
        .maybeSingle();

      if (existing) {
        setMessage({ type: 'error', text: 'Für dieses Datum existiert bereits ein Eintrag. Aktivieren Sie die Checkbox zum Überschreiben.' });
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('work_entries')
        .insert({
          driver_id: driver.id,
          vehicle: manualVehicle.toUpperCase(),
          date: manualDate,
          start_time: manualStartTime,
          end_time: manualEndTime,
          break_minutes: breakMins,
          notes: manualNote || null
        });

      if (error) {
        console.error('Add entry error:', error);
        setMessage({ type: 'error', text: `Fehler: ${error.message}` });
      } else {
        setMessage({ type: 'success', text: 'Eintrag erfolgreich gespeichert' });
        // Reset form
        setManualDriverCode('');
        setManualVehicle('');
        setManualStartTime('');
        setManualEndTime('');
        setManualBreakMinutes('0');
        setManualNote('');
        setAllowMultipleEntries(false);
        loadDrivers();
      }
    } catch (error: any) {
      console.error('Unexpected error:', error);
      setMessage({ type: 'error', text: 'Fehler beim Speichern' });
    }
  };

  const searchEntries = async () => {
    if (!supabase) return;

    setLoading(true);
    try {
      let query = supabase
        .from('work_entries')
        .select('*, driver:drivers(*)');

      if (filterStartDate) {
        query = query.gte('date', filterStartDate);
      }
      if (filterEndDate) {
        query = query.lte('date', filterEndDate);
      }

      if (filterSearchType === 'vehicle' && filterVehicle) {
        query = query.eq('vehicle', filterVehicle.toUpperCase());
      } else if (filterSearchType === 'driver' && filterDriverCode) {
        const driver = findDriver(filterDriverCode);
        if (driver) {
          query = query.eq('driver_id', driver.id);
        } else {
          setFilteredEntries([]);
          setMessage({ type: 'error', text: 'Fahrer nicht gefunden' });
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query.order('date', { ascending: false });

      if (error) {
        console.error('Search error:', error);
        setMessage({ type: 'error', text: `Fehler: ${error.message}` });
      } else {
        setFilteredEntries(data || []);
        if (!data || data.length === 0) {
          setMessage({ type: 'error', text: 'Keine Einträge gefunden' });
        }
      }
    } catch (error: any) {
      console.error('Unexpected error:', error);
      setMessage({ type: 'error', text: 'Fehler bei der Suche' });
    } finally {
      setLoading(false);
    }
  };

  const deleteEntry = async (entryId: string) => {
    if (!supabase) return;
    if (!confirm('Eintrag wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('work_entries')
        .delete()
        .eq('id', entryId);

      if (error) {
        setMessage({ type: 'error', text: `Fehler: ${error.message}` });
      } else {
        setMessage({ type: 'success', text: 'Eintrag gelöscht' });
        setFilteredEntries(prev => prev.filter(e => e.id !== entryId));
        loadDrivers();
      }
    } catch (error: any) {
      console.error('Delete entry error:', error);
      setMessage({ type: 'error', text: 'Fehler beim Löschen' });
    }
  };

  const getTodayEntries = () => {
    const today = new Date().toISOString().split('T')[0];
    const entries: (WorkEntry & { driver: Driver })[] = [];

    drivers.forEach(driver => {
      driver.work_entries?.forEach(entry => {
        if (entry.date === today) {
          entries.push({ ...entry, driver });
        }
      });
    });

    return entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  // ============ CALCULATIONS ============

  const calculateWorkHours = (startTime: string, endTime: string, breakMinutes: number): number => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    totalMinutes -= breakMinutes;
    return totalMinutes / 60;
  };

  const formatHours = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // ============ REPORTS ============

  const generateMonthlyReport = () => {
    const driver = findDriver(reportDriverCode);
    if (!driver) return null;

    const year = parseInt(reportYear);
    const month = parseInt(reportMonth);

    const entries = (driver.work_entries || []).filter(entry => {
      const date = new Date(entry.date);
      return date.getFullYear() === year && date.getMonth() === month - 1;
    });

    let totalHours = 0;
    let totalOvertime = 0;

    // Group by date
    const byDate: { [date: string]: WorkEntry[] } = {};
    entries.forEach(entry => {
      if (!byDate[entry.date]) byDate[entry.date] = [];
      byDate[entry.date].push(entry);
    });

    // Calculate daily totals and overtime
    const dailyData: { date: string; hours: number; overtime: number }[] = [];
    Object.keys(byDate).sort().forEach(date => {
      let dayHours = 0;
      byDate[date].forEach(entry => {
        dayHours += calculateWorkHours(entry.start_time, entry.end_time, entry.break_minutes);
      });
      const dayOvertime = Math.max(0, dayHours - STANDARD_DAILY_HOURS);
      totalHours += dayHours;
      totalOvertime += dayOvertime;
      dailyData.push({ date, hours: dayHours, overtime: dayOvertime });
    });

    return {
      driver,
      workDays: Object.keys(byDate).length,
      totalHours,
      totalOvertime,
      dailyData
    };
  };

  const compareDrivers = () => {
    const driver1 = findDriver(compareDriver1Code);
    const driver2 = findDriver(compareDriver2Code);

    if (!driver1 || !driver2) return null;

    const year = parseInt(compareYear);
    const month = parseInt(compareMonth);

    const calculateStats = (driver: DriverWithWorkEntries) => {
      const entries = (driver.work_entries || []).filter(entry => {
        const date = new Date(entry.date);
        return date.getFullYear() === year && date.getMonth() === month - 1;
      });

      let totalHours = 0;
      let totalOvertime = 0;
      const dates = new Set<string>();

      const byDate: { [date: string]: WorkEntry[] } = {};
      entries.forEach(entry => {
        dates.add(entry.date);
        if (!byDate[entry.date]) byDate[entry.date] = [];
        byDate[entry.date].push(entry);
      });

      Object.keys(byDate).forEach(date => {
        let dayHours = 0;
        byDate[date].forEach(entry => {
          dayHours += calculateWorkHours(entry.start_time, entry.end_time, entry.break_minutes);
        });
        const dayOvertime = Math.max(0, dayHours - STANDARD_DAILY_HOURS);
        totalHours += dayHours;
        totalOvertime += dayOvertime;
      });

      return {
        workDays: dates.size,
        totalHours,
        totalOvertime,
        avgHoursPerDay: dates.size > 0 ? totalHours / dates.size : 0
      };
    };

    return {
      driver1: { ...calculateStats(driver1), name: driver1.driver_name, code: driver1.driver_code },
      driver2: { ...calculateStats(driver2), name: driver2.driver_name, code: driver2.driver_code }
    };
  };

  const generatePDF = () => {
    const report = generateMonthlyReport();
    if (!report) {
      setMessage({ type: 'error', text: 'Bitte Fahrer auswählen' });
      return;
    }

    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.text('Trans Oflex', 14, 20);
    doc.setFontSize(14);
    doc.text('Monatsbericht', 14, 30);

    // Driver info
    doc.setFontSize(10);
    doc.text(`Fahrer: ${report.driver.driver_name}`, 14, 40);
    doc.text(`Code: ${report.driver.driver_code}`, 14, 46);
    doc.text(`Zeitraum: ${reportMonth}/${reportYear}`, 14, 52);
    doc.text(`Erstellt: ${new Date().toLocaleDateString('de-DE')}`, 14, 58);

    // Summary
    doc.setFontSize(12);
    doc.text('Zusammenfassung', 14, 70);
    doc.setFontSize(10);
    doc.text(`Arbeitstage: ${report.workDays}`, 14, 78);
    doc.text(`Gesamtstunden: ${formatHours(report.totalHours)}`, 14, 84);
    doc.text(`Überstunden: ${formatHours(report.totalOvertime)}`, 14, 90);

    // Daily details
    if (report.dailyData.length > 0) {
      doc.setFontSize(12);
      doc.text('Tägliche Aufschlüsselung', 14, 102);
      doc.setFontSize(9);

      let y = 110;
      report.dailyData.forEach(day => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const dateStr = new Date(day.date).toLocaleDateString('de-DE');
        doc.text(`${dateStr}: ${formatHours(day.hours)} (Überstunden: ${formatHours(day.overtime)})`, 14, y);
        y += 6;
      });
    }

    doc.save(`monatsbericht_${report.driver.driver_code}_${reportMonth}_${reportYear}.pdf`);
    setMessage({ type: 'success', text: 'PDF erfolgreich erstellt' });
  };

  if (!hasSupabaseConfig) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-600 font-bold text-xl mb-2">Konfigurationsfehler</h2>
          <p className="text-red-500">Fehlende Supabase-Umgebungsvariablen.</p>
        </div>
      </div>
    );
  }

  const monthlyReport = generateMonthlyReport();
  const comparison = compareDrivers();
  const todayEntries = getTodayEntries();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin-Dashboard</h1>
            <p className="text-gray-600">Fahrer-Arbeitszeitverwaltung</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            <LogOut className="w-5 h-5" />
            Abmelden
          </button>
        </div>
      </div>

      {/* Error/Success Message */}
      {message && (
        <div className={`mx-6 mt-6 p-4 rounded-lg ${
          message.type === 'error'
            ? 'bg-red-50 border border-red-200 text-red-800'
            : 'bg-green-50 border border-green-200 text-green-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 mx-6 mt-6 rounded-t-lg">
        <div className="flex">
          <button
            onClick={() => setActiveTab('fahrer')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition ${
              activeTab === 'fahrer'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-5 h-5" />
            Fahrer
          </button>
          <button
            onClick={() => setActiveTab('eintraege')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition ${
              activeTab === 'eintraege'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-5 h-5" />
            Einträge
          </button>
          <button
            onClick={() => setActiveTab('berichte')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition ${
              activeTab === 'berichte'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart2 className="w-5 h-5" />
            Berichte
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-6 pb-20">
        {/* FAHRER TAB */}
        {activeTab === 'fahrer' && (
          <div className="space-y-6">
            {/* Add Driver */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Fahrer hinzufügen</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Code (Zahl) *</label>
                  <input
                    type="text"
                    value={newDriverCode}
                    onChange={(e) => setNewDriverCode(e.target.value)}
                    placeholder="z.B. 101"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Name *</label>
                  <input
                    type="text"
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    placeholder="z.B. Max Mustermann"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                onClick={addDriver}
                disabled={loading}
                className="mt-4 flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Plus className="w-5 h-5" />
                Hinzufügen
              </button>
            </div>

            {/* Drivers List */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Alle Fahrer</h2>
              {drivers.length === 0 ? (
                <p className="text-gray-500 text-center py-12">Keine Fahrer vorhanden</p>
              ) : (
                <div className="space-y-3">
                  {drivers.map((driver) => (
                    <div key={driver.id} className="border border-gray-200 rounded-lg p-4">
                      {editingDriver?.id === driver.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="text"
                              value={editCode}
                              onChange={(e) => setEditCode(e.target.value)}
                              placeholder="Code"
                              className="px-3 py-2 border border-gray-300 rounded"
                            />
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Name"
                              className="px-3 py-2 border border-gray-300 rounded"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={saveDriverEdit}
                              className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                            >
                              <Save className="w-4 h-4" />
                              Speichern
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                            >
                              <X className="w-4 h-4" />
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {driver.driver_name} (Code: {driver.driver_code})
                            </p>
                            <p className="text-sm text-gray-600">
                              Einträge: {driver.work_entries?.length || 0}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditDriver(driver)}
                              className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteDriver(driver.id)}
                              className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* EINTRÄGE TAB */}
        {activeTab === 'eintraege' && (
          <div className="space-y-6">
            {/* Today's Entries */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Heutige Einträge</h2>
              {todayEntries.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Keine Einträge für heute</p>
              ) : (
                <div className="space-y-3">
                  {todayEntries.map(entry => {
                    const hours = calculateWorkHours(entry.start_time, entry.end_time, entry.break_minutes);
                    return (
                      <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
                        <p className="font-semibold text-gray-900">
                          {entry.driver.driver_name} (Code: {entry.driver.driver_code})
                        </p>
                        <p className="text-sm text-gray-600">
                          {entry.start_time} - {entry.end_time} | {formatHours(hours)} | {entry.vehicle}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Manual Entry Form */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Eintrag manuell hinzufügen</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Fahrer (Code oder Name) *</label>
                  <input
                    type="text"
                    value={manualDriverCode}
                    onChange={(e) => setManualDriverCode(e.target.value)}
                    placeholder="Code oder Name eingeben..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Fahrzeug *</label>
                  <input
                    type="text"
                    value={manualVehicle}
                    onChange={(e) => setManualVehicle(e.target.value)}
                    placeholder="z.B. LKW 01"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Datum *</label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Start *</label>
                    <input
                      type="time"
                      value={manualStartTime}
                      onChange={(e) => setManualStartTime(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Ende *</label>
                    <input
                      type="time"
                      value={manualEndTime}
                      onChange={(e) => setManualEndTime(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Pause (Min)</label>
                    <input
                      type="number"
                      value={manualBreakMinutes}
                      onChange={(e) => setManualBreakMinutes(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Notiz (optional)</label>
                  <input
                    type="text"
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                    placeholder="Optional..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="allowMultiple"
                    checked={allowMultipleEntries}
                    onChange={(e) => setAllowMultipleEntries(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <label htmlFor="allowMultiple" className="text-gray-700">
                    Trotzdem speichern (Admin) - Mehrere Einträge pro Tag erlauben
                  </label>
                </div>
                <button
                  onClick={addManualEntry}
                  disabled={loading}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  + Eintrag speichern
                </button>
              </div>
            </div>

            {/* Search Entries */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Einträge suchen/filtern</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Von</label>
                    <input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Bis</label>
                    <input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Suche nach</label>
                  <select
                    value={filterSearchType}
                    onChange={(e) => setFilterSearchType(e.target.value as any)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="vehicle">Fahrzeug</option>
                    <option value="driver">Fahrer</option>
                  </select>
                </div>
                {filterSearchType === 'vehicle' ? (
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Fahrzeug</label>
                    <input
                      type="text"
                      value={filterVehicle}
                      onChange={(e) => setFilterVehicle(e.target.value)}
                      placeholder="z.B. LKW 01"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Fahrer (Code oder Name)</label>
                    <input
                      type="text"
                      value={filterDriverCode}
                      onChange={(e) => setFilterDriverCode(e.target.value)}
                      placeholder="Code oder Name eingeben..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
                <button
                  onClick={searchEntries}
                  disabled={loading}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  Suchen
                </button>
              </div>

              {filteredEntries.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h3 className="font-bold text-gray-900">Ergebnisse ({filteredEntries.length})</h3>
                  {filteredEntries.map(entry => {
                    const hours = calculateWorkHours(entry.start_time, entry.end_time, entry.break_minutes);
                    return (
                      <div key={entry.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {entry.driver?.driver_name} (Code: {entry.driver?.driver_code})
                          </p>
                          <p className="text-sm text-gray-600">
                            {new Date(entry.date).toLocaleDateString('de-DE')} | {entry.start_time} - {entry.end_time} |
                            {formatHours(hours)} | {entry.vehicle}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* BERICHTE TAB */}
        {activeTab === 'berichte' && (
          <div className="space-y-6">
            {/* Monthly Report */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Monatsbericht</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Fahrer (Code oder Name) *</label>
                  <input
                    type="text"
                    value={reportDriverCode}
                    onChange={(e) => setReportDriverCode(e.target.value)}
                    placeholder="Code oder Name eingeben..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Jahr</label>
                    <input
                      type="number"
                      value={reportYear}
                      onChange={(e) => setReportYear(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Monat</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={reportMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {monthlyReport && (
                <div className="mt-6 space-y-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Arbeitstage</p>
                    <p className="text-3xl font-bold text-gray-900">{monthlyReport.workDays}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Gesamtstunden</p>
                    <p className="text-3xl font-bold text-gray-900">{formatHours(monthlyReport.totalHours)}</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Überstunden</p>
                    <p className="text-3xl font-bold text-gray-900">{formatHours(monthlyReport.totalOvertime)}</p>
                  </div>
                  <button
                    onClick={generatePDF}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                  >
                    <Download className="w-5 h-5" />
                    PDF erstellen
                  </button>
                </div>
              )}
            </div>

            {/* Compare Drivers */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Fahrer vergleichen</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Fahrer 1 *</label>
                  <input
                    type="text"
                    value={compareDriver1Code}
                    onChange={(e) => setCompareDriver1Code(e.target.value)}
                    placeholder="Code oder Name eingeben..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Fahrer 2 *</label>
                  <input
                    type="text"
                    value={compareDriver2Code}
                    onChange={(e) => setCompareDriver2Code(e.target.value)}
                    placeholder="Code oder Name eingeben..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Jahr</label>
                    <input
                      type="number"
                      value={compareYear}
                      onChange={(e) => setCompareYear(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Monat</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={compareMonth}
                      onChange={(e) => setCompareMonth(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {comparison && (
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="border-2 border-blue-500 rounded-lg p-4 bg-blue-50">
                    <p className="font-bold text-gray-900 mb-3">{comparison.driver1.name}</p>
                    <p className="text-sm text-gray-600">Arbeitstage: {comparison.driver1.workDays}</p>
                    <p className="text-sm text-gray-600">Stunden: {formatHours(comparison.driver1.totalHours)}</p>
                    <p className="text-sm text-gray-600">Überstunden: {formatHours(comparison.driver1.totalOvertime)}</p>
                    <p className="text-sm text-gray-600">Ø/Tag: {formatHours(comparison.driver1.avgHoursPerDay)}</p>
                  </div>
                  <div className="border-2 border-green-500 rounded-lg p-4 bg-green-50">
                    <p className="font-bold text-gray-900 mb-3">{comparison.driver2.name}</p>
                    <p className="text-sm text-gray-600">Arbeitstage: {comparison.driver2.workDays}</p>
                    <p className="text-sm text-gray-600">Stunden: {formatHours(comparison.driver2.totalHours)}</p>
                    <p className="text-sm text-gray-600">Überstunden: {formatHours(comparison.driver2.totalOvertime)}</p>
                    <p className="text-sm text-gray-600">Ø/Tag: {formatHours(comparison.driver2.avgHoursPerDay)}</p>
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
