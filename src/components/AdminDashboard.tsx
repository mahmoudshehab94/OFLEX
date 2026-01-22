import { useState, useEffect } from 'react';
import {
  LogOut, Users, FileText, Settings, Moon, Download, BarChart2
} from 'lucide-react';
import { supabase, Driver, WorkTime, DriverWithWorkTimes, hasSupabaseConfig } from '../lib/supabase';
import jsPDF from 'jspdf';

interface AdminDashboardProps {
  onLogout: () => void;
}

type Tab = 'berichte' | 'eintraege' | 'fahrer';

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('berichte');
  const [drivers, setDrivers] = useState<DriverWithWorkTimes[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Monatsbericht states
  const [reportDriverInput, setReportDriverInput] = useState('');
  const [reportYear, setReportYear] = useState(new Date().getFullYear().toString());
  const [reportMonth, setReportMonth] = useState((new Date().getMonth() + 1).toString());

  // Fahrerabrechnung states
  const [invoiceDriverInput, setInvoiceDriverInput] = useState('');
  const [invoicePeriod, setInvoicePeriod] = useState('last-month');

  // Fahrer vergleichen states
  const [compareDriver1Input, setCompareDriver1Input] = useState('');
  const [compareDriver2Input, setCompareDriver2Input] = useState('');
  const [compareYear, setCompareYear] = useState(new Date().getFullYear().toString());
  const [compareMonth, setCompareMonth] = useState((new Date().getMonth() + 1).toString());

  // Eintrag manuell hinzufügen states
  const [manualDriverInput, setManualDriverInput] = useState('');
  const [manualVehicle, setManualVehicle] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualPause, setManualPause] = useState('0');
  const [manualStartTime, setManualStartTime] = useState('');
  const [manualEndTime, setManualEndTime] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualAllowMultiple, setManualAllowMultiple] = useState(false);

  // Filter states
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSearchType, setFilterSearchType] = useState('vehicle');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filteredEntries, setFilteredEntries] = useState<(WorkTime & { driver?: Driver })[]>([]);

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    if (!supabase) {
      setMessage({ type: 'error', text: 'Supabase nicht konfiguriert' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase
        .from('drivers')
        .select(`
          *,
          work_times (*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Load error:', error);
        setMessage({ type: 'error', text: `Interner Serverfehler` });
        setLoading(false);
        return;
      }

      setDrivers(data || []);
    } catch (error: any) {
      console.error('Load error:', error);
      setMessage({ type: 'error', text: `Interner Serverfehler` });
    } finally {
      setLoading(false);
    }
  };

  const calculateDuration = (start: string, end: string): { hours: number; minutes: number; totalMinutes: number } => {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return { hours, minutes, totalMinutes };
  };

  const formatTimeHHMM = (hours: number, minutes: number): string => {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const getTodayEntries = () => {
    const today = new Date().toISOString().split('T')[0];
    const entries: { driver: Driver; workTime: WorkTime }[] = [];

    drivers.forEach(driver => {
      driver.work_times?.forEach(wt => {
        if (wt.work_date === today) {
          entries.push({ driver, workTime: wt });
        }
      });
    });

    return entries.sort((a, b) =>
      new Date(b.workTime.created_at).getTime() - new Date(a.workTime.created_at).getTime()
    );
  };

  const findDriverByCodeOrName = (input: string): Driver | null => {
    if (!input.trim()) return null;
    const search = input.trim().toLowerCase();
    return drivers.find(d =>
      d.driver_code.toLowerCase() === search ||
      d.driver_name.toLowerCase() === search
    ) || null;
  };

  const calculateMonthlyReport = () => {
    const driver = findDriverByCodeOrName(reportDriverInput);
    if (!driver) return null;

    const year = parseInt(reportYear);
    const month = parseInt(reportMonth);

    const filteredWorkTimes = (driver.work_times || []).filter(wt => {
      const date = new Date(wt.work_date);
      return date.getFullYear() === year && date.getMonth() === month - 1;
    });

    let totalMinutes = 0;
    filteredWorkTimes.forEach(wt => {
      const duration = calculateDuration(wt.start_time, wt.end_time);
      totalMinutes += duration.totalMinutes;
    });

    const workDays = filteredWorkTimes.length;
    const totalHours = Math.floor(totalMinutes / 60);
    const totalMins = totalMinutes % 60;

    // Calculate overtime (assuming 8 hours per day is standard)
    const standardMinutes = workDays * 8 * 60;
    const overtimeMinutes = totalMinutes - standardMinutes;
    const overtimeHours = Math.floor(overtimeMinutes / 60);
    const overtimeMins = overtimeMinutes % 60;

    return {
      driver,
      workDays,
      totalHours,
      totalMins,
      overtimeHours,
      overtimeMins
    };
  };

  const generatePDF = () => {
    const driver = findDriverByCodeOrName(invoiceDriverInput);
    if (!driver) {
      setMessage({ type: 'error', text: 'Bitte Fahrer auswählen' });
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Fahrerabrechnung', 14, 20);
    doc.setFontSize(10);
    doc.text(`Fahrer: ${driver.driver_name || driver.driver_code}`, 14, 30);
    doc.text(`Code: ${driver.driver_code}`, 14, 36);
    doc.text(`Zeitraum: ${invoicePeriod}`, 14, 42);
    doc.text(`Erstellt: ${new Date().toLocaleDateString('de-DE')}`, 14, 48);

    doc.save(`abrechnung_${driver.driver_code}_${new Date().toISOString().split('T')[0]}.pdf`);
    setMessage({ type: 'success', text: 'PDF erfolgreich erstellt' });
  };

  const compareDrivers = () => {
    const driver1 = findDriverByCodeOrName(compareDriver1Input);
    const driver2 = findDriverByCodeOrName(compareDriver2Input);

    if (!driver1 || !driver2) return null;

    const year = parseInt(compareYear);
    const month = parseInt(compareMonth);

    const calculateStats = (driver: DriverWithWorkTimes) => {
      const filteredWorkTimes = (driver.work_times || []).filter(wt => {
        const date = new Date(wt.work_date);
        return date.getFullYear() === year && date.getMonth() === month - 1;
      });

      let totalMinutes = 0;
      filteredWorkTimes.forEach(wt => {
        const duration = calculateDuration(wt.start_time, wt.end_time);
        totalMinutes += duration.totalMinutes;
      });

      return {
        workDays: filteredWorkTimes.length,
        totalHours: Math.floor(totalMinutes / 60),
        totalMins: totalMinutes % 60
      };
    };

    return {
      driver1: { ...calculateStats(driver1), name: driver1.driver_name || driver1.driver_code },
      driver2: { ...calculateStats(driver2), name: driver2.driver_name || driver2.driver_code }
    };
  };

  const saveManualEntry = async () => {
    if (!supabase) return;

    const driver = findDriverByCodeOrName(manualDriverInput);
    if (!driver) {
      setMessage({ type: 'error', text: 'Fahrer nicht gefunden' });
      return;
    }

    if (!manualVehicle || !manualStartTime || !manualEndTime) {
      setMessage({ type: 'error', text: 'Bitte alle Pflichtfelder ausfüllen' });
      return;
    }

    // Check if entry already exists for this date
    if (!manualAllowMultiple) {
      const { data: existing } = await supabase
        .from('work_times')
        .select('id')
        .eq('driver_id', driver.id)
        .eq('work_date', manualDate)
        .maybeSingle();

      if (existing) {
        setMessage({ type: 'error', text: 'Für dieses Datum existiert bereits ein Eintrag' });
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('work_times')
        .insert({
          driver_id: driver.id,
          work_date: manualDate,
          start_time: manualStartTime,
          end_time: manualEndTime,
          vehicle: manualVehicle.toUpperCase(),
          notes: manualNote || null,
          break_minutes: parseInt(manualPause) || 0
        });

      if (error) {
        setMessage({ type: 'error', text: `Fehler: ${error.message}` });
      } else {
        setMessage({ type: 'success', text: 'Eintrag erfolgreich gespeichert' });
        // Reset form
        setManualDriverInput('');
        setManualVehicle('');
        setManualPause('0');
        setManualStartTime('');
        setManualEndTime('');
        setManualNote('');
        setManualAllowMultiple(false);
        loadDrivers();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Fehler: ${error.message}` });
    }
  };

  const performFilter = async () => {
    if (!supabase) return;

    setLoading(true);
    try {
      let query = supabase
        .from('work_times')
        .select('*, driver:drivers(*)');

      if (filterStartDate) {
        query = query.gte('work_date', filterStartDate);
      }
      if (filterEndDate) {
        query = query.lte('work_date', filterEndDate);
      }
      if (filterSearchType === 'vehicle' && filterVehicle) {
        query = query.eq('vehicle', filterVehicle.toUpperCase());
      }

      const { data, error } = await query.order('work_date', { ascending: false });

      if (error) {
        setMessage({ type: 'error', text: `Fehler: ${error.message}` });
      } else {
        setFilteredEntries(data || []);
        if (!data || data.length === 0) {
          setMessage({ type: 'error', text: 'Keine Einträge gefunden. Fahrer können über die Startseite Einträge erstellen.' });
        }
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Fehler: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  if (!hasSupabaseConfig) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-600 font-bold text-xl mb-2">Konfigurationsfehler</h2>
          <p className="text-red-500">
            Fehlende Supabase-Umgebungsvariablen.
          </p>
        </div>
      </div>
    );
  }

  const monthlyReport = calculateMonthlyReport();
  const driverComparison = compareDrivers();
  const todayEntries = getTodayEntries();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Admin-Dashboard</h1>
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition">
              <Moon className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition">
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={onLogout}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <LogOut className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
        <p className="text-gray-600">Fahrer-Arbeitszeitverwaltung</p>
      </div>

      {/* Error Message */}
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
      <div className="bg-white border-b border-gray-200 mx-6 mt-6 rounded-t-lg overflow-hidden">
        <div className="flex">
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
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-6 pb-20">
        {/* Berichte Tab */}
        {activeTab === 'berichte' && (
          <div className="space-y-6">
            {/* Heutige Einträge */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Heutige Einträge</h2>
              {todayEntries.length === 0 ? (
                <p className="text-gray-500 text-center py-12">Keine Einträge für heute vorhanden.</p>
              ) : (
                <div className="space-y-3">
                  {todayEntries.map(({ driver, workTime }) => {
                    const duration = calculateDuration(workTime.start_time, workTime.end_time);
                    return (
                      <div key={workTime.id} className="border border-gray-200 rounded-lg p-4">
                        <p className="font-semibold text-gray-900">{driver.driver_name || driver.driver_code}</p>
                        <p className="text-sm text-gray-600">
                          {workTime.start_time} - {workTime.end_time} | {formatTimeHHMM(duration.hours, duration.minutes)} | {workTime.vehicle}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Monatsbericht */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Monatsbericht</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    Fahrer auswählen (Code oder Name) *
                  </label>
                  <input
                    type="text"
                    value={reportDriverInput}
                    onChange={(e) => setReportDriverInput(e.target.value)}
                    placeholder="Code oder Name eingeben..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Jahr</label>
                  <input
                    type="number"
                    value={reportYear}
                    onChange={(e) => setReportYear(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {!reportDriverInput ? (
                <p className="text-gray-500 text-center py-8 mt-6">Bitte Fahrer auswählen</p>
              ) : !monthlyReport ? (
                <p className="text-gray-500 text-center py-8 mt-6">Fahrer nicht gefunden</p>
              ) : (
                <div className="mt-6 space-y-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Arbeitstage</p>
                    <p className="text-4xl font-bold text-gray-900">{monthlyReport.workDays}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Gesamtarbeitszeit</p>
                    <p className="text-4xl font-bold text-gray-900">
                      {formatTimeHHMM(monthlyReport.totalHours, monthlyReport.totalMins)}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Überstunden</p>
                    <p className="text-4xl font-bold text-gray-900">
                      {formatTimeHHMM(monthlyReport.overtimeHours, monthlyReport.overtimeMins)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Fahrerabrechnung erstellen */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Fahrerabrechnung erstellen</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    Fahrer auswählen *
                  </label>
                  <input
                    type="text"
                    value={invoiceDriverInput}
                    onChange={(e) => setInvoiceDriverInput(e.target.value)}
                    placeholder="Code oder Name eingeben..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Zeitraum *</label>
                  <select
                    value={invoicePeriod}
                    onChange={(e) => setInvoicePeriod(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="last-month">Letzter Monat</option>
                    <option value="current-month">Aktueller Monat</option>
                    <option value="last-3-months">Letzte 3 Monate</option>
                  </select>
                </div>

                <button
                  onClick={generatePDF}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  <Download className="w-5 h-5" />
                  PDF erstellen
                </button>
              </div>
            </div>

            {/* Fahrer vergleichen */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Fahrer vergleichen</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Fahrer 1 *</label>
                  <input
                    type="text"
                    value={compareDriver1Input}
                    onChange={(e) => setCompareDriver1Input(e.target.value)}
                    placeholder="Code oder Name eingeben..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Fahrer 2 *</label>
                  <input
                    type="text"
                    value={compareDriver2Input}
                    onChange={(e) => setCompareDriver2Input(e.target.value)}
                    placeholder="Code oder Name eingeben..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Jahr</label>
                  <input
                    type="number"
                    value={compareYear}
                    onChange={(e) => setCompareYear(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <button
                  onClick={() => setMessage(null)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium w-full"
                >
                  Vergleichen
                </button>
              </div>

              {driverComparison && (
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <p className="font-semibold text-gray-900 mb-3">{driverComparison.driver1.name}</p>
                    <p className="text-sm text-gray-600">Arbeitstage: {driverComparison.driver1.workDays}</p>
                    <p className="text-sm text-gray-600">
                      Gesamtzeit: {formatTimeHHMM(driverComparison.driver1.totalHours, driverComparison.driver1.totalMins)}
                    </p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <p className="font-semibold text-gray-900 mb-3">{driverComparison.driver2.name}</p>
                    <p className="text-sm text-gray-600">Arbeitstage: {driverComparison.driver2.workDays}</p>
                    <p className="text-sm text-gray-600">
                      Gesamtzeit: {formatTimeHHMM(driverComparison.driver2.totalHours, driverComparison.driver2.totalMins)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Einträge Tab */}
        {activeTab === 'eintraege' && (
          <div className="space-y-6">
            {/* Eintrag manuell hinzufügen */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Eintrag manuell hinzufügen</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    Fahrer (Code oder Name) *
                  </label>
                  <input
                    type="text"
                    value={manualDriverInput}
                    onChange={(e) => setManualDriverInput(e.target.value)}
                    placeholder="Code oder Name eingeben..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Fahrzeug *</label>
                  <input
                    type="text"
                    value={manualVehicle}
                    onChange={(e) => setManualVehicle(e.target.value)}
                    placeholder="z.B. LKW 01"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Datum *</label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Pause (Minuten)</label>
                  <input
                    type="number"
                    value={manualPause}
                    onChange={(e) => setManualPause(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">von (Startzeit) *</label>
                  <input
                    type="time"
                    value={manualStartTime}
                    onChange={(e) => setManualStartTime(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">bis (Endzeit) *</label>
                  <input
                    type="time"
                    value={manualEndTime}
                    onChange={(e) => setManualEndTime(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Notiz</label>
                  <input
                    type="text"
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                    placeholder="Optional..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="allowMultiple"
                    checked={manualAllowMultiple}
                    onChange={(e) => setManualAllowMultiple(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="allowMultiple" className="text-gray-700">
                    Trotzdem speichern (Admin) - Mehrere Einträge pro Tag erlauben
                  </label>
                </div>

                <button
                  onClick={saveManualEntry}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium w-full disabled:opacity-50"
                >
                  + Eintrag speichern
                </button>
              </div>
            </div>

            {/* Filter */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Filter</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Von *</label>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Bis *</label>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Suche nach *</label>
                  <select
                    value={filterSearchType}
                    onChange={(e) => setFilterSearchType(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-100"
                  >
                    <option value="vehicle">Fahrzeug</option>
                    <option value="driver">Fahrer</option>
                    <option value="all">Alle</option>
                  </select>
                </div>

                {filterSearchType === 'vehicle' && (
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Fahrzeug *</label>
                    <input
                      type="text"
                      value={filterVehicle}
                      onChange={(e) => setFilterVehicle(e.target.value)}
                      placeholder="Fahrzeug eingeben..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}

                <button
                  onClick={performFilter}
                  disabled={loading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium w-full disabled:opacity-50"
                >
                  Suchen
                </button>
              </div>

              {filteredEntries.length === 0 && (
                <p className="text-gray-500 text-center py-12 mt-6">
                  Keine Einträge gefunden. Fahrer können über die Startseite Einträge erstellen.
                </p>
              )}

              {filteredEntries.length > 0 && (
                <div className="mt-6 space-y-3">
                  {filteredEntries.map((entry) => {
                    const duration = calculateDuration(entry.start_time, entry.end_time);
                    return (
                      <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
                        <p className="font-semibold text-gray-900">
                          {entry.driver?.driver_name || entry.driver?.driver_code}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(entry.work_date).toLocaleDateString('de-DE')} | {entry.start_time} - {entry.end_time} |
                          {formatTimeHHMM(duration.hours, duration.minutes)} | {entry.vehicle}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fahrer Tab */}
        {activeTab === 'fahrer' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Fahrerverwaltung</h2>
            <p className="text-gray-600">Liste aller registrierten Fahrer</p>

            {drivers.length === 0 ? (
              <p className="text-gray-500 text-center py-12 mt-6">Keine Fahrer vorhanden</p>
            ) : (
              <div className="mt-6 space-y-3">
                {drivers.map((driver) => (
                  <div key={driver.id} className="border border-gray-200 rounded-lg p-4">
                    <p className="font-semibold text-gray-900">{driver.driver_name || driver.driver_code}</p>
                    <p className="text-sm text-gray-600">Code: {driver.driver_code}</p>
                    <p className="text-sm text-gray-600">Einträge: {driver.work_times?.length || 0}</p>
                    {!driver.is_active && (
                      <span className="inline-block mt-2 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                        Deaktiviert
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
