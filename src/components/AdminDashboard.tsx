import { useState, useEffect } from 'react';
import {
  LogOut, Users, Clock, BarChart3, FileDown, GitCompare,
  FileText, Edit2, Trash2, Save, X, Ban, Check
} from 'lucide-react';
import { supabase, Driver, WorkTime, DriverWithWorkTimes, hasSupabaseConfig } from '../lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

interface AdminDashboardProps {
  onLogout: () => void;
}

type Tab = 'drivers' | 'worktimes' | 'statistics' | 'export' | 'compare' | 'reports';
type DateFilter = 'all' | 'week' | 'month' | 'year' | 'custom';

interface DriverStats {
  driverId: string;
  driverCode: string;
  totalHours: number;
  totalMinutes: number;
  totalEntries: number;
  averageHoursPerDay: number;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('drivers');
  const [drivers, setDrivers] = useState<DriverWithWorkTimes[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [editDriverCode, setEditDriverCode] = useState('');
  const [editDriverName, setEditDriverName] = useState('');

  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedDriverFilter, setSelectedDriverFilter] = useState<string>('all');

  const [compareDriver1, setCompareDriver1] = useState<string>('');
  const [compareDriver2, setCompareDriver2] = useState<string>('');
  const [compareMonth, setCompareMonth] = useState('');

  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    if (autoRefresh && activeTab === 'reports') {
      const interval = setInterval(loadData, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, activeTab]);

  const loadData = async () => {
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
        setMessage({ type: 'error', text: `Fehler: ${error.message}` });
        setLoading(false);
        return;
      }

      setDrivers(data || []);
    } catch (error: any) {
      console.error('Load error:', error);
      setMessage({ type: 'error', text: `Fehler: ${error.message}` });
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

  const formatDuration = (hours: number, minutes: number): string => {
    return `${hours}h ${minutes}m`;
  };

  const getDateRange = (): { start: Date | null; end: Date | null } => {
    const now = new Date();

    switch (dateFilter) {
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        return { start: weekStart, end: now };

      case 'month':
        const monthStart = new Date(now);
        monthStart.setMonth(now.getMonth() - 1);
        return { start: monthStart, end: now };

      case 'year':
        const yearStart = new Date(now);
        yearStart.setFullYear(now.getFullYear() - 1);
        return { start: yearStart, end: now };

      case 'custom':
        return {
          start: customStartDate ? new Date(customStartDate) : null,
          end: customEndDate ? new Date(customEndDate) : null,
        };

      default:
        return { start: null, end: null };
    }
  };

  const filterWorkTimes = (workTimes: WorkTime[]): WorkTime[] => {
    const { start, end } = getDateRange();

    return workTimes.filter(wt => {
      const wtDate = new Date(wt.work_date);

      if (start && wtDate < start) return false;
      if (end && wtDate > end) return false;

      return true;
    });
  };

  const calculateStats = (): DriverStats[] => {
    return drivers
      .filter(driver => selectedDriverFilter === 'all' || driver.id === selectedDriverFilter)
      .map(driver => {
        const filteredWorkTimes = filterWorkTimes(driver.work_times || []);

        let totalMinutes = 0;
        filteredWorkTimes.forEach(wt => {
          const duration = calculateDuration(wt.start_time, wt.end_time);
          totalMinutes += duration.totalMinutes;
        });

        const totalHours = Math.floor(totalMinutes / 60);
        const remainingMinutes = totalMinutes % 60;
        const averageHoursPerDay = filteredWorkTimes.length > 0
          ? totalMinutes / 60 / filteredWorkTimes.length
          : 0;

        return {
          driverId: driver.id,
          driverCode: driver.driver_code,
          totalHours,
          totalMinutes: remainingMinutes,
          totalEntries: filteredWorkTimes.length,
          averageHoursPerDay,
        };
      });
  };

  const startEditDriver = (driver: Driver) => {
    setEditingDriverId(driver.id);
    setEditDriverCode(driver.driver_code);
    setEditDriverName(`${driver.license_letters} ${driver.license_numbers}`);
  };

  const cancelEditDriver = () => {
    setEditingDriverId(null);
    setEditDriverCode('');
    setEditDriverName('');
  };

  const saveDriverEdit = async (driverId: string) => {
    if (!supabase) return;

    const nameParts = editDriverName.trim().split(/\s+/);
    if (nameParts.length < 2) {
      setMessage({ type: 'error', text: 'Bitte geben Sie Kennzeichenbuchstaben und -nummern ein (z.B. "ABC 123")' });
      return;
    }

    const letters = nameParts.slice(0, -1).join(' ');
    const numbers = nameParts[nameParts.length - 1];

    try {
      const { error } = await supabase
        .from('drivers')
        .update({
          driver_code: editDriverCode.trim(),
          license_letters: letters,
          license_numbers: numbers,
        })
        .eq('id', driverId);

      if (error) {
        setMessage({ type: 'error', text: `Fehler beim Speichern: ${error.message}` });
      } else {
        setMessage({ type: 'success', text: 'Fahrer erfolgreich aktualisiert' });
        cancelEditDriver();
        loadData();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Fehler: ${error.message}` });
    }
  };

  const deleteDriver = async (driverId: string) => {
    if (!supabase) return;

    if (!confirm('Möchten Sie diesen Fahrer wirklich löschen?')) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', driverId);

      if (error) {
        if (error.code === '23503') {
          setMessage({
            type: 'error',
            text: 'Fahrer kann nicht gelöscht werden, da Einträge vorhanden sind. Verwenden Sie "Deaktivieren" stattdessen.'
          });
        } else {
          setMessage({ type: 'error', text: `Fehler beim Löschen: ${error.message}` });
        }
      } else {
        setMessage({ type: 'success', text: 'Fahrer erfolgreich gelöscht' });
        loadData();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Fehler: ${error.message}` });
    }
  };

  const disableDriver = async (driverId: string) => {
    if (!supabase) return;

    if (!confirm('Möchten Sie diesen Fahrer wirklich deaktivieren?')) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .update({ driver_code: `[DEAKTIVIERT] ${drivers.find(d => d.id === driverId)?.driver_code}` })
        .eq('id', driverId);

      if (error) {
        setMessage({ type: 'error', text: `Fehler beim Deaktivieren: ${error.message}` });
      } else {
        setMessage({ type: 'success', text: 'Fahrer erfolgreich deaktiviert' });
        loadData();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Fehler: ${error.message}` });
    }
  };

  const deleteWorkTime = async (workTimeId: string) => {
    if (!supabase) return;

    if (!confirm('Möchten Sie diesen Eintrag wirklich löschen? Der Fahrer kann dann für diesen Tag erneut einreichen.')) return;

    try {
      const { error } = await supabase
        .from('work_times')
        .delete()
        .eq('id', workTimeId);

      if (error) {
        setMessage({ type: 'error', text: `Fehler beim Löschen: ${error.message}` });
      } else {
        setMessage({ type: 'success', text: 'Eintrag erfolgreich gelöscht' });
        loadData();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Fehler: ${error.message}` });
    }
  };

  const exportToExcel = () => {
    const stats = calculateStats();

    const wsData = [
      ['Fahrer Code', 'Gesamtstunden', 'Gesamtminuten', 'Einträge', 'Durchschnitt pro Tag'],
      ...stats.map(s => [
        s.driverCode,
        s.totalHours,
        s.totalMinutes,
        s.totalEntries,
        s.averageHoursPerDay.toFixed(2),
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Statistik');

    XLSX.writeFile(wb, `arbeitszeiten_${new Date().toISOString().split('T')[0]}.xlsx`);
    setMessage({ type: 'success', text: 'Excel-Datei erfolgreich exportiert' });
  };

  const exportDriverMonthlyExcel = (driver: DriverWithWorkTimes) => {
    const workTimes = filterWorkTimes(driver.work_times || []);

    const wsData = [
      ['Datum', 'Startzeit', 'Endzeit', 'Dauer'],
      ...workTimes.map(wt => {
        const duration = calculateDuration(wt.start_time, wt.end_time);
        return [
          new Date(wt.work_date).toLocaleDateString('de-DE'),
          wt.start_time,
          wt.end_time,
          formatDuration(duration.hours, duration.minutes),
        ];
      }),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, driver.driver_code);

    XLSX.writeFile(wb, `${driver.driver_code}_${new Date().toISOString().split('T')[0]}.xlsx`);
    setMessage({ type: 'success', text: `Excel-Datei für ${driver.driver_code} erfolgreich exportiert` });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const stats = calculateStats();

    doc.setFontSize(18);
    doc.text('Arbeitszeiten Statistik', 14, 20);

    doc.setFontSize(10);
    doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 14, 30);
    doc.text(`Filter: ${dateFilter === 'all' ? 'Alle' : dateFilter === 'week' ? 'Letzte Woche' : dateFilter === 'month' ? 'Letzter Monat' : dateFilter === 'year' ? 'Letztes Jahr' : 'Benutzerdefiniert'}`, 14, 36);

    let yPos = 50;
    stats.forEach(stat => {
      doc.text(`Fahrer: ${stat.driverCode}`, 14, yPos);
      doc.text(`Gesamtzeit: ${stat.totalHours}h ${stat.totalMinutes}m`, 14, yPos + 6);
      doc.text(`Einträge: ${stat.totalEntries}`, 14, yPos + 12);
      doc.text(`Durchschnitt/Tag: ${stat.averageHoursPerDay.toFixed(2)}h`, 14, yPos + 18);
      yPos += 30;

      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
    });

    doc.save(`arbeitszeiten_${new Date().toISOString().split('T')[0]}.pdf`);
    setMessage({ type: 'success', text: 'PDF-Datei erfolgreich exportiert' });
  };

  const compareDrivers = () => {
    if (!compareDriver1 || !compareDriver2 || !compareMonth) {
      setMessage({ type: 'error', text: 'Bitte wählen Sie zwei Fahrer und einen Monat aus' });
      return;
    }

    const driver1 = drivers.find(d => d.id === compareDriver1);
    const driver2 = drivers.find(d => d.id === compareDriver2);

    if (!driver1 || !driver2) return;

    const monthDate = new Date(compareMonth);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    const filterByMonth = (workTimes: WorkTime[]) => {
      return workTimes.filter(wt => {
        const wtDate = new Date(wt.work_date);
        return wtDate >= monthStart && wtDate <= monthEnd;
      });
    };

    const wt1 = filterByMonth(driver1.work_times || []);
    const wt2 = filterByMonth(driver2.work_times || []);

    let total1 = 0;
    wt1.forEach(wt => {
      total1 += calculateDuration(wt.start_time, wt.end_time).totalMinutes;
    });

    let total2 = 0;
    wt2.forEach(wt => {
      total2 += calculateDuration(wt.start_time, wt.end_time).totalMinutes;
    });

    const hours1 = Math.floor(total1 / 60);
    const mins1 = total1 % 60;
    const hours2 = Math.floor(total2 / 60);
    const mins2 = total2 % 60;

    return {
      driver1: {
        code: driver1.driver_code,
        hours: hours1,
        minutes: mins1,
        entries: wt1.length,
      },
      driver2: {
        code: driver2.driver_code,
        hours: hours2,
        minutes: mins2,
        entries: wt2.length,
      },
    };
  };

  const comparisonResult = activeTab === 'compare' ? compareDrivers() : null;

  if (!hasSupabaseConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 max-w-md">
          <h2 className="text-red-400 font-bold text-xl mb-2">Konfigurationsfehler</h2>
          <p className="text-red-300">
            Fehlende Supabase-Umgebungsvariablen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              <LogOut className="w-4 h-4" />
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="flex flex-wrap border-b border-slate-700">
            <button
              onClick={() => setActiveTab('drivers')}
              className={`flex items-center justify-center gap-2 px-4 py-3 font-medium transition ${
                activeTab === 'drivers'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Users className="w-5 h-5" />
              Fahrer
            </button>
            <button
              onClick={() => setActiveTab('worktimes')}
              className={`flex items-center justify-center gap-2 px-4 py-3 font-medium transition ${
                activeTab === 'worktimes'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Clock className="w-5 h-5" />
              Einträge
            </button>
            <button
              onClick={() => setActiveTab('statistics')}
              className={`flex items-center justify-center gap-2 px-4 py-3 font-medium transition ${
                activeTab === 'statistics'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              Statistik
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`flex items-center justify-center gap-2 px-4 py-3 font-medium transition ${
                activeTab === 'export'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <FileDown className="w-5 h-5" />
              Export
            </button>
            <button
              onClick={() => setActiveTab('compare')}
              className={`flex items-center justify-center gap-2 px-4 py-3 font-medium transition ${
                activeTab === 'compare'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <GitCompare className="w-5 h-5" />
              Vergleich
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center justify-center gap-2 px-4 py-3 font-medium transition ${
                activeTab === 'reports'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <FileText className="w-5 h-5" />
              Berichte
            </button>
          </div>

          <div className="p-6">
            {message && (
              <div
                className={`mb-4 p-4 rounded-lg ${
                  message.type === 'success'
                    ? 'bg-green-900/50 text-green-200 border border-green-700'
                    : 'bg-red-900/50 text-red-200 border border-red-700'
                }`}
              >
                {message.text}
              </div>
            )}

            {loading ? (
              <div className="text-center text-gray-400 py-8">Lädt...</div>
            ) : (
              <>
                {activeTab === 'drivers' && (
                  <div className="space-y-4">
                    <h2 className="text-xl font-bold text-white mb-4">Fahrerverwaltung</h2>
                    {drivers.length === 0 ? (
                      <p className="text-gray-400 text-center py-8">Keine Fahrer vorhanden</p>
                    ) : (
                      drivers.map((driver) => (
                        <div
                          key={driver.id}
                          className="bg-slate-700 rounded-lg p-4 border border-slate-600"
                        >
                          {editingDriverId === driver.id ? (
                            <div className="space-y-3">
                              <div>
                                <label className="text-gray-300 text-sm block mb-1">Fahrer Code</label>
                                <input
                                  type="text"
                                  value={editDriverCode}
                                  onChange={(e) => setEditDriverCode(e.target.value)}
                                  className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-gray-300 text-sm block mb-1">Kennzeichen (z.B. "ABC 123")</label>
                                <input
                                  type="text"
                                  value={editDriverName}
                                  onChange={(e) => setEditDriverName(e.target.value)}
                                  className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveDriverEdit(driver.id)}
                                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                                >
                                  <Save className="w-4 h-4" />
                                  Speichern
                                </button>
                                <button
                                  onClick={cancelEditDriver}
                                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                                >
                                  <X className="w-4 h-4" />
                                  Abbrechen
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-white font-semibold text-lg">
                                  Code: {driver.driver_code}
                                </h3>
                                <p className="text-gray-300 text-sm">
                                  Kennzeichen: {driver.license_letters} {driver.license_numbers}
                                </p>
                                <p className="text-gray-400 text-xs mt-1">
                                  Erstellt: {new Date(driver.created_at).toLocaleDateString('de-DE')}
                                </p>
                                <p className="text-blue-400 text-sm mt-1">
                                  {driver.work_times?.length || 0} Einträge
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => startEditDriver(driver)}
                                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Bearbeiten
                                </button>
                                {!driver.work_times || driver.work_times.length === 0 ? (
                                  <button
                                    onClick={() => deleteDriver(driver.id)}
                                    className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Löschen
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => disableDriver(driver.id)}
                                    className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition"
                                  >
                                    <Ban className="w-4 h-4" />
                                    Deaktivieren
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'worktimes' && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-bold text-white mb-4">Einträge Verwaltung</h2>
                    {drivers.length === 0 ? (
                      <p className="text-gray-400 text-center py-8">Keine Arbeitszeiten vorhanden</p>
                    ) : (
                      drivers.map((driver) => (
                        <div key={driver.id} className="space-y-2">
                          <h3 className="text-white font-semibold text-lg border-b border-slate-600 pb-2">
                            {driver.driver_code} - {driver.license_letters} {driver.license_numbers}
                          </h3>
                          {!driver.work_times || driver.work_times.length === 0 ? (
                            <p className="text-gray-500 text-sm py-2">Keine Einträge</p>
                          ) : (
                            <div className="space-y-2">
                              {driver.work_times
                                .sort((a, b) => new Date(b.work_date).getTime() - new Date(a.work_date).getTime())
                                .map((workTime) => {
                                  const duration = calculateDuration(workTime.start_time, workTime.end_time);
                                  return (
                                    <div
                                      key={workTime.id}
                                      className="bg-slate-700 rounded-lg p-3 border border-slate-600 flex items-center justify-between"
                                    >
                                      <div className="grid grid-cols-3 gap-4 text-sm flex-1">
                                        <div>
                                          <span className="text-gray-400">Datum:</span>
                                          <span className="text-white ml-2">
                                            {new Date(workTime.work_date).toLocaleDateString('de-DE')}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-gray-400">Zeit:</span>
                                          <span className="text-white ml-2">
                                            {workTime.start_time} - {workTime.end_time}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-gray-400">Dauer:</span>
                                          <span className="text-blue-400 ml-2 font-semibold">
                                            {formatDuration(duration.hours, duration.minutes)}
                                          </span>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => deleteWorkTime(workTime.id)}
                                        className="ml-4 p-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                                        title="Eintrag löschen"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'statistics' && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-bold text-white mb-4">Statistiken</h2>

                    <div className="bg-slate-700 rounded-lg p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-gray-300 text-sm block mb-2">Zeitraum</label>
                          <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                            className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
                          >
                            <option value="all">Alle</option>
                            <option value="week">Letzte Woche</option>
                            <option value="month">Letzter Monat</option>
                            <option value="year">Letztes Jahr</option>
                            <option value="custom">Benutzerdefiniert</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-gray-300 text-sm block mb-2">Fahrer Filter</label>
                          <select
                            value={selectedDriverFilter}
                            onChange={(e) => setSelectedDriverFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
                          >
                            <option value="all">Alle Fahrer</option>
                            {drivers.map(driver => (
                              <option key={driver.id} value={driver.id}>
                                {driver.driver_code}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {dateFilter === 'custom' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-gray-300 text-sm block mb-2">Von</label>
                            <input
                              type="date"
                              value={customStartDate}
                              onChange={(e) => setCustomStartDate(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-gray-300 text-sm block mb-2">Bis</label>
                            <input
                              type="date"
                              value={customEndDate}
                              onChange={(e) => setCustomEndDate(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {calculateStats().map(stat => (
                        <div key={stat.driverId} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                          <h3 className="text-white font-semibold text-lg mb-3">{stat.driverCode}</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-gray-400 text-sm">Gesamtzeit</p>
                              <p className="text-blue-400 font-semibold text-xl">
                                {stat.totalHours}h {stat.totalMinutes}m
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-sm">Einträge</p>
                              <p className="text-blue-400 font-semibold text-xl">{stat.totalEntries}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-sm">Ø pro Tag</p>
                              <p className="text-blue-400 font-semibold text-xl">
                                {stat.averageHoursPerDay.toFixed(1)}h
                              </p>
                            </div>
                            <div>
                              <button
                                onClick={() => {
                                  const driver = drivers.find(d => d.id === stat.driverId);
                                  if (driver) exportDriverMonthlyExcel(driver);
                                }}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm"
                              >
                                Export Excel
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'export' && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-bold text-white mb-4">Daten Export</h2>

                    <div className="bg-slate-700 rounded-lg p-6 space-y-4">
                      <p className="text-gray-300 mb-4">
                        Exportieren Sie alle Daten basierend auf den aktuellen Filtereinstellungen.
                      </p>

                      <div className="flex flex-wrap gap-4">
                        <button
                          onClick={exportToExcel}
                          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          <FileDown className="w-5 h-5" />
                          Excel exportieren
                        </button>

                        <button
                          onClick={exportToPDF}
                          className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                        >
                          <FileDown className="w-5 h-5" />
                          PDF exportieren
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-700 rounded-lg p-6">
                      <h3 className="text-white font-semibold text-lg mb-4">Einzelne Fahrer exportieren</h3>
                      <div className="space-y-2">
                        {drivers.map(driver => (
                          <div key={driver.id} className="flex items-center justify-between p-3 bg-slate-600 rounded">
                            <span className="text-white">{driver.driver_code}</span>
                            <button
                              onClick={() => exportDriverMonthlyExcel(driver)}
                              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm"
                            >
                              Excel exportieren
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'compare' && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-bold text-white mb-4">Fahrer Vergleich</h2>

                    <div className="bg-slate-700 rounded-lg p-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-gray-300 text-sm block mb-2">Fahrer 1</label>
                          <select
                            value={compareDriver1}
                            onChange={(e) => setCompareDriver1(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">Wählen...</option>
                            {drivers.map(driver => (
                              <option key={driver.id} value={driver.id}>
                                {driver.driver_code}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-gray-300 text-sm block mb-2">Fahrer 2</label>
                          <select
                            value={compareDriver2}
                            onChange={(e) => setCompareDriver2(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">Wählen...</option>
                            {drivers.map(driver => (
                              <option key={driver.id} value={driver.id}>
                                {driver.driver_code}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-gray-300 text-sm block mb-2">Monat</label>
                          <input
                            type="month"
                            value={compareMonth}
                            onChange={(e) => setCompareMonth(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {comparisonResult && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-700 rounded-lg p-6 border-2 border-blue-500">
                          <h3 className="text-white font-semibold text-xl mb-4">
                            {comparisonResult.driver1.code}
                          </h3>
                          <div className="space-y-3">
                            <div>
                              <p className="text-gray-400 text-sm">Gesamtzeit</p>
                              <p className="text-blue-400 font-bold text-2xl">
                                {comparisonResult.driver1.hours}h {comparisonResult.driver1.minutes}m
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-sm">Einträge</p>
                              <p className="text-white font-semibold text-xl">
                                {comparisonResult.driver1.entries}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-700 rounded-lg p-6 border-2 border-green-500">
                          <h3 className="text-white font-semibold text-xl mb-4">
                            {comparisonResult.driver2.code}
                          </h3>
                          <div className="space-y-3">
                            <div>
                              <p className="text-gray-400 text-sm">Gesamtzeit</p>
                              <p className="text-green-400 font-bold text-2xl">
                                {comparisonResult.driver2.hours}h {comparisonResult.driver2.minutes}m
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-sm">Einträge</p>
                              <p className="text-white font-semibold text-xl">
                                {comparisonResult.driver2.entries}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'reports' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-white">Tägliche Berichte</h2>
                      <label className="flex items-center gap-2 text-gray-300">
                        <input
                          type="checkbox"
                          checked={autoRefresh}
                          onChange={(e) => setAutoRefresh(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Auto-Aktualisierung (30s)</span>
                      </label>
                    </div>

                    <div className="space-y-4">
                      {drivers.map(driver => {
                        const workTimesByDate = (driver.work_times || []).reduce((acc, wt) => {
                          const date = wt.work_date;
                          if (!acc[date]) acc[date] = [];
                          acc[date].push(wt);
                          return acc;
                        }, {} as Record<string, WorkTime[]>);

                        const sortedDates = Object.keys(workTimesByDate).sort((a, b) =>
                          new Date(b).getTime() - new Date(a).getTime()
                        );

                        return (
                          <div key={driver.id} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                            <h3 className="text-white font-semibold text-lg mb-3">
                              {driver.driver_code} - {driver.license_letters} {driver.license_numbers}
                            </h3>

                            {sortedDates.length === 0 ? (
                              <p className="text-gray-500 text-sm">Keine Einträge</p>
                            ) : (
                              <div className="space-y-2">
                                {sortedDates.slice(0, 5).map(date => {
                                  const dayWorkTimes = workTimesByDate[date];
                                  const totalDayMinutes = dayWorkTimes.reduce((sum, wt) => {
                                    return sum + calculateDuration(wt.start_time, wt.end_time).totalMinutes;
                                  }, 0);
                                  const dayHours = Math.floor(totalDayMinutes / 60);
                                  const dayMinutes = totalDayMinutes % 60;

                                  return (
                                    <div key={date} className="bg-slate-600 rounded p-3">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <p className="text-white font-medium">
                                            {new Date(date).toLocaleDateString('de-DE', {
                                              weekday: 'long',
                                              year: 'numeric',
                                              month: 'long',
                                              day: 'numeric'
                                            })}
                                          </p>
                                          <p className="text-gray-400 text-sm">
                                            {dayWorkTimes.length} Eintrag{dayWorkTimes.length !== 1 ? 'e' : ''}
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-blue-400 font-semibold text-lg">
                                            {formatDuration(dayHours, dayMinutes)}
                                          </p>
                                          <div className="flex items-center gap-1 text-green-400 text-sm">
                                            <Check className="w-4 h-4" />
                                            Eingereicht
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
