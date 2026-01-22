import { useState, useEffect } from 'react';
import {
  LogOut, Users, Clock, FileText, Edit2, Trash2, Save, X, Ban,
  Search, FileDown, BarChart3, GitCompare, Plus, Key, CheckCircle
} from 'lucide-react';
import { supabase, Driver, WorkTime, DriverWithWorkTimes, hasSupabaseConfig } from '../lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

interface AdminDashboardProps {
  onLogout: () => void;
}

type Tab = 'berichte' | 'entries' | 'drivers';

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('berichte');
  const [drivers, setDrivers] = useState<DriverWithWorkTimes[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [editDriverCode, setEditDriverCode] = useState('');
  const [editDriverName, setEditDriverName] = useState('');

  const [newDriverCode, setNewDriverCode] = useState('');
  const [newDriverName, setNewDriverName] = useState('');

  const [searchType, setSearchType] = useState<'driver' | 'vehicle' | 'both'>('driver');
  const [searchDriverCode, setSearchDriverCode] = useState('');
  const [searchVehicle, setSearchVehicle] = useState('');
  const [searchStartDate, setSearchStartDate] = useState('');
  const [searchEndDate, setSearchEndDate] = useState('');
  const [searchResults, setSearchResults] = useState<WorkTime[]>([]);

  const [statsDriverId, setStatsDriverId] = useState('');
  const [statsFilter, setStatsFilter] = useState<'current' | 'custom' | 'week' | 'month' | 'year'>('current');
  const [statsStartDate, setStatsStartDate] = useState('');
  const [statsEndDate, setStatsEndDate] = useState('');

  const [compareDriver1, setCompareDriver1] = useState('');
  const [compareDriver2, setCompareDriver2] = useState('');
  const [compareMonth, setCompareMonth] = useState('');

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadDrivers();
  }, []);

  useEffect(() => {
    if (autoRefresh && activeTab === 'berichte') {
      const interval = setInterval(loadDrivers, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, activeTab]);

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

  const addDriver = async () => {
    if (!supabase) return;

    if (!newDriverCode.trim() || !newDriverName.trim()) {
      setMessage({ type: 'error', text: 'Bitte Fahrer-Code und Name eingeben' });
      return;
    }

    try {
      const { error } = await supabase
        .from('drivers')
        .insert({
          driver_code: newDriverCode.trim(),
          driver_name: newDriverName.trim(),
          license_letters: '',
          license_numbers: '',
          is_active: true
        });

      if (error) {
        if (error.code === '23505') {
          setMessage({ type: 'error', text: 'Fahrer-Code bereits vergeben' });
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
      setMessage({ type: 'error', text: `Fehler: ${error.message}` });
    }
  };

  const startEditDriver = (driver: Driver) => {
    setEditingDriverId(driver.id);
    setEditDriverCode(driver.driver_code);
    setEditDriverName(driver.driver_name);
  };

  const cancelEditDriver = () => {
    setEditingDriverId(null);
    setEditDriverCode('');
    setEditDriverName('');
  };

  const saveDriverEdit = async (driverId: string) => {
    if (!supabase) return;

    if (!editDriverCode.trim()) {
      setMessage({ type: 'error', text: 'Fahrer-Code darf nicht leer sein' });
      return;
    }

    try {
      const { error } = await supabase
        .from('drivers')
        .update({
          driver_code: editDriverCode.trim(),
          driver_name: editDriverName.trim()
        })
        .eq('id', driverId);

      if (error) {
        if (error.code === '23505') {
          setMessage({ type: 'error', text: 'Fahrer-Code bereits vergeben' });
        } else {
          setMessage({ type: 'error', text: `Fehler: ${error.message}` });
        }
      } else {
        setMessage({ type: 'success', text: 'Fahrer erfolgreich aktualisiert' });
        cancelEditDriver();
        loadDrivers();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Fehler: ${error.message}` });
    }
  };

  const deleteDriver = async (driverId: string) => {
    if (!supabase) return;

    const driver = drivers.find(d => d.id === driverId);
    if (driver && driver.work_times && driver.work_times.length > 0) {
      setMessage({
        type: 'error',
        text: 'Fahrer kann nicht gelöscht werden (hat bestehende Einträge). Bitte deaktivieren Sie stattdessen.'
      });
      return;
    }

    if (!confirm('Möchten Sie diesen Fahrer wirklich löschen?')) return;

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
      setMessage({ type: 'error', text: `Fehler: ${error.message}` });
    }
  };

  const toggleDriverActive = async (driverId: string, currentStatus: boolean) => {
    if (!supabase) return;

    const newStatus = !currentStatus;
    const action = newStatus ? 'aktivieren' : 'deaktivieren';

    if (!confirm(`Möchten Sie diesen Fahrer wirklich ${action}?`)) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .update({ is_active: newStatus })
        .eq('id', driverId);

      if (error) {
        setMessage({ type: 'error', text: `Fehler: ${error.message}` });
      } else {
        setMessage({ type: 'success', text: `Fahrer erfolgreich ${newStatus ? 'aktiviert' : 'deaktiviert'}` });
        loadDrivers();
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
        setMessage({ type: 'error', text: `Fehler: ${error.message}` });
      } else {
        setMessage({ type: 'success', text: 'Eintrag erfolgreich gelöscht' });
        loadDrivers();
        if (searchResults.length > 0) {
          performSearch();
        }
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Fehler: ${error.message}` });
    }
  };

  const performSearch = async () => {
    if (!supabase) return;

    setLoading(true);
    setMessage(null);

    try {
      let query = supabase
        .from('work_times')
        .select('*');

      if (searchType === 'driver' && searchDriverCode) {
        const { data: driver } = await supabase
          .from('drivers')
          .select('id')
          .eq('driver_code', searchDriverCode)
          .maybeSingle();

        if (!driver) {
          setMessage({ type: 'error', text: 'Fahrer nicht gefunden' });
          setSearchResults([]);
          setLoading(false);
          return;
        }

        query = query.eq('driver_id', driver.id);
      } else if (searchType === 'vehicle' && searchVehicle) {
        query = query.eq('vehicle', searchVehicle.toUpperCase());
      } else if (searchType === 'both' && searchDriverCode && searchVehicle) {
        const { data: driver } = await supabase
          .from('drivers')
          .select('id')
          .eq('driver_code', searchDriverCode)
          .maybeSingle();

        if (!driver) {
          setMessage({ type: 'error', text: 'Fahrer nicht gefunden' });
          setSearchResults([]);
          setLoading(false);
          return;
        }

        query = query.eq('driver_id', driver.id).eq('vehicle', searchVehicle.toUpperCase());
      }

      if (searchStartDate) {
        query = query.gte('work_date', searchStartDate);
      }
      if (searchEndDate) {
        query = query.lte('work_date', searchEndDate);
      }

      const { data, error } = await query.order('work_date', { ascending: false });

      if (error) {
        setMessage({ type: 'error', text: `Fehler: ${error.message}` });
      } else {
        setSearchResults(data || []);
        if (data && data.length === 0) {
          setMessage({ type: 'error', text: 'Keine Einträge gefunden' });
        }
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Fehler: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const applyDateFilter = (filter: 'week' | 'month' | 'year') => {
    const now = new Date();
    let startDate: Date;

    switch (filter) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    setSearchStartDate(startDate.toISOString().split('T')[0]);
    setSearchEndDate(now.toISOString().split('T')[0]);
  };

  const calculateDriverStats = () => {
    if (!statsDriverId) return null;

    const driver = drivers.find(d => d.id === statsDriverId);
    if (!driver) return null;

    let workTimes = driver.work_times || [];

    const filterWorkTimes = () => {
      const now = new Date();

      switch (statsFilter) {
        case 'current':
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();
          return workTimes.filter(wt => {
            const wtDate = new Date(wt.work_date);
            return wtDate.getMonth() === currentMonth && wtDate.getFullYear() === currentYear;
          });

        case 'week':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - 7);
          return workTimes.filter(wt => new Date(wt.work_date) >= weekStart);

        case 'month':
          const monthStart = new Date(now);
          monthStart.setMonth(now.getMonth() - 1);
          return workTimes.filter(wt => new Date(wt.work_date) >= monthStart);

        case 'year':
          const yearStart = new Date(now);
          yearStart.setFullYear(now.getFullYear() - 1);
          return workTimes.filter(wt => new Date(wt.work_date) >= yearStart);

        case 'custom':
          return workTimes.filter(wt => {
            const wtDate = new Date(wt.work_date);
            const start = statsStartDate ? new Date(statsStartDate) : null;
            const end = statsEndDate ? new Date(statsEndDate) : null;
            if (start && wtDate < start) return false;
            if (end && wtDate > end) return false;
            return true;
          });

        default:
          return workTimes;
      }
    };

    const filtered = filterWorkTimes();

    let totalMinutes = 0;
    filtered.forEach(wt => {
      totalMinutes += calculateDuration(wt.start_time, wt.end_time).totalMinutes;
    });

    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const daysWorked = filtered.length;
    const avgHoursPerDay = daysWorked > 0 ? totalMinutes / 60 / daysWorked : 0;

    const monthlyBreakdown: Record<string, { hours: number; minutes: number; days: number }> = {};
    filtered.forEach(wt => {
      const date = new Date(wt.work_date);
      const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!monthlyBreakdown[key]) {
        monthlyBreakdown[key] = { hours: 0, minutes: 0, days: 0 };
      }
      const duration = calculateDuration(wt.start_time, wt.end_time);
      monthlyBreakdown[key].minutes += duration.totalMinutes;
      monthlyBreakdown[key].days += 1;
    });

    Object.keys(monthlyBreakdown).forEach(key => {
      const totalMins = monthlyBreakdown[key].minutes;
      monthlyBreakdown[key].hours = Math.floor(totalMins / 60);
      monthlyBreakdown[key].minutes = totalMins % 60;
    });

    return {
      driver,
      totalHours,
      remainingMinutes,
      daysWorked,
      avgHoursPerDay,
      monthlyBreakdown
    };
  };

  const compareDrivers = () => {
    if (!compareDriver1 || !compareDriver2 || !compareMonth) return null;

    const driver1 = drivers.find(d => d.id === compareDriver1);
    const driver2 = drivers.find(d => d.id === compareDriver2);

    if (!driver1 || !driver2) return null;

    const [year, month] = compareMonth.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

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

    return {
      driver1: {
        name: driver1.driver_name || driver1.driver_code,
        code: driver1.driver_code,
        hours: Math.floor(total1 / 60),
        minutes: total1 % 60,
        days: wt1.length,
        avgPerDay: wt1.length > 0 ? (total1 / 60 / wt1.length).toFixed(1) : '0.0'
      },
      driver2: {
        name: driver2.driver_name || driver2.driver_code,
        code: driver2.driver_code,
        hours: Math.floor(total2 / 60),
        minutes: total2 % 60,
        days: wt2.length,
        avgPerDay: wt2.length > 0 ? (total2 / 60 / wt2.length).toFixed(1) : '0.0'
      }
    };
  };

  const exportAllToExcel = () => {
    const wsData = [
      ['Fahrer Code', 'Fahrer Name', 'Datum', 'Von', 'Bis', 'Arbeitsstunden', 'Fahrzeug', 'Notizen']
    ];

    drivers.forEach(driver => {
      driver.work_times?.forEach(wt => {
        const duration = calculateDuration(wt.start_time, wt.end_time);
        wsData.push([
          driver.driver_code,
          driver.driver_name,
          new Date(wt.work_date).toLocaleDateString('de-DE'),
          wt.start_time,
          wt.end_time,
          formatDuration(duration.hours, duration.minutes),
          wt.vehicle,
          wt.notes || ''
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alle Daten');

    XLSX.writeFile(wb, `trans_oflex_alle_daten_${new Date().toISOString().split('T')[0]}.xlsx`);
    setMessage({ type: 'success', text: 'Excel-Datei erfolgreich exportiert' });
  };

  const exportDriverMonthlyExcel = (driver: DriverWithWorkTimes, year: number, month: number) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthName = new Date(year, month - 1).toLocaleString('de-DE', { month: 'long' });

    const workTimesByDate: Record<string, WorkTime> = {};
    (driver.work_times || []).forEach(wt => {
      const wtDate = new Date(wt.work_date);
      if (wtDate.getFullYear() === year && wtDate.getMonth() === month - 1) {
        workTimesByDate[wt.work_date] = wt;
      }
    });

    const wsData = [
      [`Fahrer: ${driver.driver_name || driver.driver_code} (${driver.driver_code})`],
      [`Monat: ${monthName} ${year}`],
      [],
      ['Tag', 'Datum', 'Von', 'Bis', 'Arbeitsstunden', 'Fahrzeug', 'Notizen']
    ];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const wt = workTimesByDate[dateStr];

      if (wt) {
        const duration = calculateDuration(wt.start_time, wt.end_time);
        wsData.push([
          day,
          new Date(dateStr).toLocaleDateString('de-DE'),
          wt.start_time,
          wt.end_time,
          formatDuration(duration.hours, duration.minutes),
          wt.vehicle,
          wt.notes || ''
        ]);
      } else {
        wsData.push([
          day,
          new Date(dateStr).toLocaleDateString('de-DE'),
          '—',
          '—',
          '—',
          '—',
          ''
        ]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${monthName}`);

    XLSX.writeFile(wb, `${driver.driver_code}_${monthName}_${year}.xlsx`);
    setMessage({ type: 'success', text: `Excel-Datei für ${driver.driver_name || driver.driver_code} erfolgreich exportiert` });
  };

  const exportAllToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Trans Oflex - Arbeitszeiten', 14, 20);

    doc.setFontSize(10);
    doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 14, 30);

    let yPos = 45;
    drivers.forEach(driver => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.text(`Fahrer: ${driver.driver_name || driver.driver_code} (${driver.driver_code})`, 14, yPos);
      yPos += 7;

      doc.setFontSize(9);
      (driver.work_times || []).slice(0, 5).forEach(wt => {
        const duration = calculateDuration(wt.start_time, wt.end_time);
        const text = `${new Date(wt.work_date).toLocaleDateString('de-DE')} | ${wt.start_time}-${wt.end_time} | ${formatDuration(duration.hours, duration.minutes)} | ${wt.vehicle}`;
        doc.text(text, 14, yPos);
        yPos += 5;
      });

      yPos += 5;
    });

    doc.save(`trans_oflex_${new Date().toISOString().split('T')[0]}.pdf`);
    setMessage({ type: 'success', text: 'PDF-Datei erfolgreich exportiert' });
  };

  const changePassword = async () => {
    if (!supabase) return;

    if (newPassword.length < 4) {
      setMessage({ type: 'error', text: 'Passwort muss mindestens 4 Zeichen lang sein' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwörter stimmen nicht überein' });
      return;
    }

    try {
      const fixedId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      const { data: existing } = await supabase
        .from('admin_settings')
        .select('id')
        .eq('id', fixedId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('admin_settings')
          .update({ password: newPassword })
          .eq('id', fixedId);

        if (error) {
          setMessage({ type: 'error', text: `Fehler: ${error.message}` });
          return;
        }
      } else {
        const { error } = await supabase
          .from('admin_settings')
          .insert({ id: fixedId, password: newPassword });

        if (error) {
          setMessage({ type: 'error', text: `Fehler: ${error.message}` });
          return;
        }
      }

      setMessage({ type: 'success', text: 'Passwort erfolgreich geändert' });
      setShowPasswordChange(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setMessage({ type: 'error', text: `Fehler: ${error.message}` });
    }
  };

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

  const stats = calculateDriverStats();
  const comparison = compareDrivers();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 pb-16">
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Trans Oflex Admin</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPasswordChange(!showPasswordChange)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
              >
                <Key className="w-4 h-4" />
                Passwort ändern
              </button>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                <LogOut className="w-4 h-4" />
                Abmelden
              </button>
            </div>
          </div>
        </div>
      </header>

      {showPasswordChange && (
        <div className="container mx-auto px-4 py-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-md mx-auto">
            <h2 className="text-white font-bold text-lg mb-4">Passwort ändern</h2>
            <div className="space-y-4">
              <div>
                <label className="text-gray-300 text-sm block mb-2">Neues Passwort</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                />
              </div>
              <div>
                <label className="text-gray-300 text-sm block mb-2">Passwort bestätigen</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={changePassword}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  Speichern
                </button>
                <button
                  onClick={() => {
                    setShowPasswordChange(false);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
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

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden mb-8">
          <div className="border-b border-slate-700 bg-slate-900">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('berichte')}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition ${
                  activeTab === 'berichte'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileText className="w-5 h-5" />
                Berichte
              </button>
              <button
                onClick={() => setActiveTab('entries')}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition ${
                  activeTab === 'entries'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Clock className="w-5 h-5" />
                Einträge
              </button>
              <button
                onClick={() => setActiveTab('drivers')}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition ${
                  activeTab === 'drivers'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Users className="w-5 h-5" />
                Fahrer
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'berichte' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Heutige Berichte</h2>
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

                <div className="text-gray-400 text-sm">
                  {new Date().toLocaleDateString('de-DE', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>

                <div className="space-y-4">
                  {getTodayEntries().length === 0 ? (
                    <p className="text-gray-400 text-center py-8">Keine Einträge für heute</p>
                  ) : (
                    getTodayEntries().map(({ driver, workTime }) => {
                      const duration = calculateDuration(workTime.start_time, workTime.end_time);
                      return (
                        <div
                          key={workTime.id}
                          className="bg-slate-700 rounded-lg p-4 border border-slate-600"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-white font-semibold text-lg">
                                {driver.driver_name || driver.driver_code}
                              </h3>
                              <p className="text-gray-400 text-sm">Code: {driver.driver_code}</p>
                              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-400">Von:</span>
                                  <span className="text-white ml-2 font-mono">{workTime.start_time}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400">Bis:</span>
                                  <span className="text-white ml-2 font-mono">{workTime.end_time}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400">Dauer:</span>
                                  <span className="text-blue-400 ml-2 font-semibold">
                                    {formatDuration(duration.hours, duration.minutes)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-400">Fahrzeug:</span>
                                  <span className="text-white ml-2 font-semibold">{workTime.vehicle}</span>
                                </div>
                              </div>
                              {workTime.notes && (
                                <div className="mt-2">
                                  <span className="text-gray-400 text-sm">Notiz:</span>
                                  <span className="text-gray-300 ml-2 text-sm">{workTime.notes}</span>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => deleteWorkTime(workTime.id)}
                              className="ml-4 p-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                              title="Eintrag löschen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeTab === 'entries' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-white">Einträge Suchen</h2>

                <div className="bg-slate-700 rounded-lg p-4 space-y-4">
                  <div>
                    <label className="text-gray-300 text-sm block mb-2">Suchtyp</label>
                    <select
                      value={searchType}
                      onChange={(e) => setSearchType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500"
                    >
                      <option value="driver">Nur Fahrer</option>
                      <option value="vehicle">Nur Fahrzeug</option>
                      <option value="both">Fahrer + Fahrzeug</option>
                    </select>
                  </div>

                  {(searchType === 'driver' || searchType === 'both') && (
                    <div>
                      <label className="text-gray-300 text-sm block mb-2">Fahrer-Code</label>
                      <input
                        type="text"
                        value={searchDriverCode}
                        onChange={(e) => setSearchDriverCode(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500"
                        placeholder="z.B. D001"
                      />
                    </div>
                  )}

                  {(searchType === 'vehicle' || searchType === 'both') && (
                    <div>
                      <label className="text-gray-300 text-sm block mb-2">Fahrzeug</label>
                      <input
                        type="text"
                        value={searchVehicle}
                        onChange={(e) => setSearchVehicle(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500"
                        placeholder="z.B. MI299"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-gray-300 text-sm block mb-2">Von Datum</label>
                      <input
                        type="date"
                        value={searchStartDate}
                        onChange={(e) => setSearchStartDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500"
                      />
                    </div>
                    <div>
                      <label className="text-gray-300 text-sm block mb-2">Bis Datum</label>
                      <input
                        type="date"
                        value={searchEndDate}
                        onChange={(e) => setSearchEndDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => applyDateFilter('week')}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition text-sm"
                    >
                      Letzte Woche
                    </button>
                    <button
                      onClick={() => applyDateFilter('month')}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition text-sm"
                    >
                      Letzter Monat
                    </button>
                    <button
                      onClick={() => applyDateFilter('year')}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition text-sm"
                    >
                      Letztes Jahr
                    </button>
                  </div>

                  <button
                    onClick={performSearch}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    <Search className="w-5 h-5" />
                    Suchen
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-white font-semibold text-lg">
                      Suchergebnisse ({searchResults.length})
                    </h3>
                    {searchResults.map(wt => {
                      const driver = drivers.find(d => d.id === wt.driver_id);
                      const duration = calculateDuration(wt.start_time, wt.end_time);
                      return (
                        <div
                          key={wt.id}
                          className="bg-slate-700 rounded-lg p-4 border border-slate-600 flex items-center justify-between"
                        >
                          <div className="flex-1">
                            <h4 className="text-white font-medium">
                              {driver?.driver_name || driver?.driver_code}
                            </h4>
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-400">Datum:</span>
                                <span className="text-white ml-2">
                                  {new Date(wt.work_date).toLocaleDateString('de-DE')}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400">Zeit:</span>
                                <span className="text-white ml-2 font-mono">
                                  {wt.start_time} - {wt.end_time}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400">Dauer:</span>
                                <span className="text-blue-400 ml-2 font-semibold">
                                  {formatDuration(duration.hours, duration.minutes)}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400">Fahrzeug:</span>
                                <span className="text-white ml-2 font-semibold">{wt.vehicle}</span>
                              </div>
                            </div>
                            {wt.notes && (
                              <div className="mt-2">
                                <span className="text-gray-400 text-sm">Notiz:</span>
                                <span className="text-gray-300 ml-2 text-sm">{wt.notes}</span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => deleteWorkTime(wt.id)}
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
            )}

            {activeTab === 'drivers' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-white">Fahrerverwaltung</h2>

                <div className="bg-slate-700 rounded-lg p-4">
                  <h3 className="text-white font-semibold mb-4">Neuen Fahrer hinzufügen</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-gray-300 text-sm block mb-2">Fahrer-Code *</label>
                      <input
                        type="text"
                        value={newDriverCode}
                        onChange={(e) => setNewDriverCode(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500"
                        placeholder="z.B. D001"
                      />
                    </div>
                    <div>
                      <label className="text-gray-300 text-sm block mb-2">Name *</label>
                      <input
                        type="text"
                        value={newDriverName}
                        onChange={(e) => setNewDriverName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500"
                        placeholder="z.B. Max Mustermann"
                      />
                    </div>
                  </div>
                  <button
                    onClick={addDriver}
                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Fahrer hinzufügen
                  </button>
                </div>

                <div className="space-y-4">
                  {drivers.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">Keine Fahrer vorhanden</p>
                  ) : (
                    drivers.map((driver) => (
                      <div
                        key={driver.id}
                        className={`bg-slate-700 rounded-lg p-4 border ${
                          driver.is_active ? 'border-slate-600' : 'border-orange-700 bg-slate-700/50'
                        }`}
                      >
                        {editingDriverId === driver.id ? (
                          <div className="space-y-3">
                            <div>
                              <label className="text-gray-300 text-sm block mb-1">Fahrer-Code</label>
                              <input
                                type="text"
                                value={editDriverCode}
                                onChange={(e) => setEditDriverCode(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500"
                              />
                            </div>
                            <div>
                              <label className="text-gray-300 text-sm block mb-1">Name</label>
                              <input
                                type="text"
                                value={editDriverName}
                                onChange={(e) => setEditDriverName(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500"
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
                              <div className="flex items-center gap-3">
                                <h3 className="text-white font-semibold text-lg">
                                  {driver.driver_name || driver.driver_code}
                                </h3>
                                {!driver.is_active && (
                                  <span className="px-2 py-1 bg-orange-600 text-white text-xs rounded">
                                    Deaktiviert
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-400 text-sm">Code: {driver.driver_code}</p>
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
                              <button
                                onClick={() => toggleDriverActive(driver.id, driver.is_active)}
                                className={`flex items-center gap-2 px-3 py-2 ${
                                  driver.is_active
                                    ? 'bg-orange-600 hover:bg-orange-700'
                                    : 'bg-green-600 hover:bg-green-700'
                                } text-white rounded transition`}
                              >
                                {driver.is_active ? (
                                  <>
                                    <Ban className="w-4 h-4" />
                                    Deaktivieren
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4" />
                                    Aktivieren
                                  </>
                                )}
                              </button>
                              {(!driver.work_times || driver.work_times.length === 0) && (
                                <button
                                  onClick={() => deleteDriver(driver.id)}
                                  className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Löschen
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-bold text-white">Statistiken</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-gray-300 text-sm block mb-2">Fahrer auswählen</label>
                <select
                  value={statsDriverId}
                  onChange={(e) => setStatsDriverId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                >
                  <option value="">Bitte wählen...</option>
                  {drivers.map(driver => (
                    <option key={driver.id} value={driver.id}>
                      {driver.driver_name || driver.driver_code} ({driver.driver_code})
                    </option>
                  ))}
                </select>
              </div>

              {statsDriverId && (
                <>
                  <div>
                    <label className="text-gray-300 text-sm block mb-2">Zeitraum</label>
                    <select
                      value={statsFilter}
                      onChange={(e) => setStatsFilter(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                    >
                      <option value="current">Aktueller Monat</option>
                      <option value="week">Letzte Woche</option>
                      <option value="month">Letzter Monat</option>
                      <option value="year">Letztes Jahr</option>
                      <option value="custom">Benutzerdefiniert</option>
                    </select>
                  </div>

                  {statsFilter === 'custom' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-gray-300 text-sm block mb-2">Von</label>
                        <input
                          type="date"
                          value={statsStartDate}
                          onChange={(e) => setStatsStartDate(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                        />
                      </div>
                      <div>
                        <label className="text-gray-300 text-sm block mb-2">Bis</label>
                        <input
                          type="date"
                          value={statsEndDate}
                          onChange={(e) => setStatsEndDate(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                        />
                      </div>
                    </div>
                  )}

                  {stats && (
                    <div className="mt-6 space-y-4">
                      <div className="bg-slate-700 rounded-lg p-4">
                        <h3 className="text-white font-semibold text-lg mb-3">
                          {stats.driver.driver_name || stats.driver.driver_code}
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-gray-400 text-sm">Gesamtstunden</p>
                            <p className="text-blue-400 font-bold text-2xl">
                              {stats.totalHours}h {stats.remainingMinutes}m
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Arbeitstage</p>
                            <p className="text-blue-400 font-bold text-2xl">{stats.daysWorked}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-gray-400 text-sm">Durchschnitt pro Tag</p>
                            <p className="text-blue-400 font-bold text-2xl">
                              {stats.avgHoursPerDay.toFixed(1)}h
                            </p>
                          </div>
                        </div>
                      </div>

                      {Object.keys(stats.monthlyBreakdown).length > 0 && (
                        <div>
                          <h4 className="text-white font-semibold mb-2">Monatsübersicht</h4>
                          <div className="space-y-2">
                            {Object.entries(stats.monthlyBreakdown)
                              .sort(([a], [b]) => b.localeCompare(a))
                              .map(([month, data]) => (
                                <div key={month} className="bg-slate-700 rounded p-3 flex items-center justify-between">
                                  <span className="text-gray-300">{month}</span>
                                  <div className="text-right">
                                    <p className="text-white font-semibold">
                                      {formatDuration(data.hours, data.minutes)}
                                    </p>
                                    <p className="text-gray-400 text-xs">{data.days} Tage</p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const [year, monthNum] = month.split('-').map(Number);
                                      exportDriverMonthlyExcel(stats.driver, year, monthNum);
                                    }}
                                    className="ml-4 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm"
                                  >
                                    Excel
                                  </button>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <GitCompare className="w-6 h-6 text-green-400" />
                <h2 className="text-xl font-bold text-white">Fahrer Vergleich</h2>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-300 text-sm block mb-2">Fahrer 1</label>
                    <select
                      value={compareDriver1}
                      onChange={(e) => setCompareDriver1(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 text-sm"
                    >
                      <option value="">Wählen...</option>
                      {drivers.map(driver => (
                        <option key={driver.id} value={driver.id}>
                          {driver.driver_name || driver.driver_code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm block mb-2">Fahrer 2</label>
                    <select
                      value={compareDriver2}
                      onChange={(e) => setCompareDriver2(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 text-sm"
                    >
                      <option value="">Wählen...</option>
                      {drivers.map(driver => (
                        <option key={driver.id} value={driver.id}>
                          {driver.driver_name || driver.driver_code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-gray-300 text-sm block mb-2">Monat</label>
                  <input
                    type="month"
                    value={compareMonth}
                    onChange={(e) => setCompareMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                  />
                </div>

                {comparison && (
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="bg-blue-900/30 border-2 border-blue-500 rounded-lg p-4">
                      <h3 className="text-white font-semibold mb-3">{comparison.driver1.name}</h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-gray-400">Gesamtstunden</p>
                          <p className="text-blue-400 font-bold text-xl">
                            {comparison.driver1.hours}h {comparison.driver1.minutes}m
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">Arbeitstage</p>
                          <p className="text-white font-semibold">{comparison.driver1.days}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Ø pro Tag</p>
                          <p className="text-white font-semibold">{comparison.driver1.avgPerDay}h</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-900/30 border-2 border-green-500 rounded-lg p-4">
                      <h3 className="text-white font-semibold mb-3">{comparison.driver2.name}</h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-gray-400">Gesamtstunden</p>
                          <p className="text-green-400 font-bold text-xl">
                            {comparison.driver2.hours}h {comparison.driver2.minutes}m
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">Arbeitstage</p>
                          <p className="text-white font-semibold">{comparison.driver2.days}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Ø pro Tag</p>
                          <p className="text-white font-semibold">{comparison.driver2.avgPerDay}h</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileDown className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-bold text-white">Export</h2>
              </div>

              <div className="space-y-3">
                <button
                  onClick={exportAllToExcel}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <FileDown className="w-5 h-5" />
                  Alle Daten als Excel exportieren
                </button>

                <button
                  onClick={exportAllToPDF}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  <FileDown className="w-5 h-5" />
                  Alle Daten als PDF exportieren
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 py-2">
        <p className="text-center text-xs text-gray-500">
          created by - mahmoud shehab
        </p>
      </div>
    </div>
  );
}
