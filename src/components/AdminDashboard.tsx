import { useState, useEffect } from 'react';
import { LogOut, Users, FileText, BarChart3, Plus, Edit, Trash2, Download, Key, X } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface AdminDashboardProps {
  onLogout: () => void;
  authToken: string;
}

interface Driver {
  code: number;
  name: string;
  active: boolean;
  created_at: string;
}

interface WorkLog {
  id: number;
  driver_code: number;
  work_date: string;
  car_number: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  overtime_minutes: number;
  created_at: string;
  driver?: { code: number; name: string };
}

type Tab = 'drivers' | 'logs' | 'reports';

function formatMinutesToHHMM(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

function getMonthName(month: number): string {
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return months[month - 1] || '';
}

function normalizeVehicleNumber(vehicle: string): string {
  if (!vehicle) return vehicle;

  const match = vehicle.match(/^([A-Za-z]+)[\s-]*(\d+)$/);
  if (match) {
    const letters = match[1].toUpperCase();
    const numbers = match[2];
    return `${letters} ${numbers}`;
  }

  return vehicle;
}

export function AdminDashboard({ onLogout, authToken }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('reports');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [driverForm, setDriverForm] = useState({ code: '', name: '', active: true });
  const [editingDriver, setEditingDriver] = useState<number | null>(null);
  const [editDriverForm, setEditDriverForm] = useState({ code: '', name: '' });

  const [logFilters, setLogFilters] = useState({
    from: '',
    to: '',
    searchMode: 'vehicle' as 'vehicle' | 'driver' | 'both',
    vehicle: '',
    driverSearch: ''
  });

  const [reportData, setReportData] = useState<any>(null);
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear().toString());
  const [monthlyMonth, setMonthlyMonth] = useState((new Date().getMonth() + 1).toString());
  const [selectedDriverForReport, setSelectedDriverForReport] = useState<string>('');
  const [driverSuggestions, setDriverSuggestions] = useState<Driver[]>([]);
  const [todayEntries, setTodayEntries] = useState<WorkLog[]>([]);
  const [driverSearchTimeout, setDriverSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const [vehicleSuggestions, setVehicleSuggestions] = useState<string[]>([]);
  const [allVehicles, setAllVehicles] = useState<string[]>([]);
  const [vehicleSearchTimeout, setVehicleSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [selectedVehicleIndex, setSelectedVehicleIndex] = useState(-1);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', newPassword: '', confirmPassword: '' });

  const [confirmDeleteDriver, setConfirmDeleteDriver] = useState<{ show: boolean; driver: Driver | null }>({ show: false, driver: null });
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<{ show: boolean; entryId: number | null }>({ show: false, entryId: null });
  const [confirmCodeChange, setConfirmCodeChange] = useState<{ show: boolean; oldCode: number; newCode: string; name: string } | null>(null);

  const [pdfDriver, setPdfDriver] = useState('');
  const [pdfDateRange, setPdfDateRange] = useState<'custom' | 'lastWeek' | 'lastMonth' | 'lastYear'>('lastMonth');
  const [pdfFromDate, setPdfFromDate] = useState('');
  const [pdfToDate, setPdfToDate] = useState('');
  const [pdfDriverSuggestions, setPdfDriverSuggestions] = useState<Driver[]>([]);
  const [pdfSearchTimeout, setPdfSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const [compareDriver1, setCompareDriver1] = useState('');
  const [compareDriver2, setCompareDriver2] = useState('');
  const [compareYear, setCompareYear] = useState(new Date().getFullYear().toString());
  const [compareMonth, setCompareMonth] = useState((new Date().getMonth() + 1).toString());
  const [compareDriver1Suggestions, setCompareDriver1Suggestions] = useState<Driver[]>([]);
  const [compareDriver2Suggestions, setCompareDriver2Suggestions] = useState<Driver[]>([]);
  const [compareTimeout1, setCompareTimeout1] = useState<NodeJS.Timeout | null>(null);
  const [compareTimeout2, setCompareTimeout2] = useState<NodeJS.Timeout | null>(null);
  const [comparisonData, setComparisonData] = useState<any>(null);

  const [manualEntryForm, setManualEntryForm] = useState({
    driver: '',
    vehicle: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    pauseMinutes: '',
    note: '',
    forceCreate: false
  });
  const [manualEntryDriverSuggestions, setManualEntryDriverSuggestions] = useState<Driver[]>([]);
  const [manualEntryTimeout, setManualEntryTimeout] = useState<NodeJS.Timeout | null>(null);

  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
      {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          ...options.headers,
        },
      }
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  };

  const loadDrivers = async () => {
    setDataLoading(true);
    try {
      const data = await apiCall('admin-drivers');
      setDrivers(data.drivers || []);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setDataLoading(false);
    }
  };

  const loadLogs = async () => {
    if (!logFilters.from || !logFilters.to) {
      setMessage({ type: 'error', text: 'Bitte wählen Sie ein Datum-Bereich (Von und Bis)' });
      return;
    }

    if (logFilters.searchMode === 'vehicle' && !logFilters.vehicle) {
      setMessage({ type: 'error', text: 'Bitte geben Sie eine Fahrzeugnummer ein' });
      return;
    }

    if (logFilters.searchMode === 'driver' && !logFilters.driverSearch) {
      setMessage({ type: 'error', text: 'Bitte geben Sie einen Fahrer-Code oder Namen ein' });
      return;
    }

    if (logFilters.searchMode === 'both' && (!logFilters.vehicle || !logFilters.driverSearch)) {
      setMessage({ type: 'error', text: 'Bitte geben Sie sowohl Fahrzeug als auch Fahrer ein' });
      return;
    }

    setDataLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('from', logFilters.from);
      params.append('to', logFilters.to);
      params.append('mode', logFilters.searchMode);

      if (logFilters.searchMode === 'vehicle' || logFilters.searchMode === 'both') {
        params.append('vehicle', logFilters.vehicle);
      }

      if (logFilters.searchMode === 'driver' || logFilters.searchMode === 'both') {
        params.append('driver', logFilters.driverSearch);
      }

      const data = await apiCall(`admin-logs?${params.toString()}`);
      setLogs(data.logs || []);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setDataLoading(false);
    }
  };

  const loadReports = async () => {
    if (!selectedDriverForReport) {
      setReportData(null);
      return;
    }

    if (!monthlyYear || !monthlyMonth) {
      setMessage({ type: 'error', text: 'Ungültiger Monat oder Jahr' });
      return;
    }

    setDataLoading(true);
    try {
      const data = await apiCall(
        `admin-reports?type=monthly&year=${monthlyYear}&month=${monthlyMonth}&driver=${selectedDriverForReport}`
      );
      setReportData(data);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      setReportData(null);
    } finally {
      setDataLoading(false);
    }
  };

  const loadTodayEntries = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await apiCall(`admin-logs?from=${today}&to=${today}&mode=all`);
      setTodayEntries(data.logs || []);
    } catch (error: any) {
      console.error('Error loading today entries:', error);
    }
  };

  const loadAllVehicles = async () => {
    try {
      const data = await apiCall('admin-logs?from=2020-01-01&to=2099-12-31&mode=all');
      const vehicles = [...new Set((data.logs || []).map((log: WorkLog) => log.car_number))];
      setAllVehicles(vehicles.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
    } catch (error: any) {
      console.error('Error loading vehicles:', error);
    }
  };

  const handleVehicleInputChange = (value: string) => {
    setLogFilters({ ...logFilters, vehicle: value });
    setSelectedVehicleIndex(-1);

    if (vehicleSearchTimeout) {
      clearTimeout(vehicleSearchTimeout);
    }

    if (value.length > 0) {
      const timeout = setTimeout(() => {
        const filtered = allVehicles.filter(v =>
          v.toLowerCase().startsWith(value.toLowerCase())
        );
        setVehicleSuggestions(filtered);
        setShowVehicleDropdown(true);
      }, 300);
      setVehicleSearchTimeout(timeout);
    } else {
      setVehicleSuggestions([]);
      setShowVehicleDropdown(false);
    }
  };

  const handleVehicleSelect = (vehicle: string) => {
    setLogFilters({ ...logFilters, vehicle });
    setVehicleSuggestions([]);
    setShowVehicleDropdown(false);
    setSelectedVehicleIndex(-1);
  };

  const handleVehicleKeyDown = (e: React.KeyboardEvent) => {
    if (!showVehicleDropdown || vehicleSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedVehicleIndex(prev =>
        prev < vehicleSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedVehicleIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && selectedVehicleIndex >= 0) {
      e.preventDefault();
      handleVehicleSelect(vehicleSuggestions[selectedVehicleIndex]);
    } else if (e.key === 'Escape') {
      setShowVehicleDropdown(false);
      setSelectedVehicleIndex(-1);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Passwort muss mindestens 8 Zeichen haben' });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwörter stimmen nicht überein' });
      return;
    }

    setLoading(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-change-password`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Passwortänderung fehlgeschlagen' });
        return;
      }

      setMessage({ type: 'success', text: 'Passwort erfolgreich geändert' });
      setShowPasswordChange(false);
      setPasswordForm({ current: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('Password change error:', error);
      setMessage({ type: 'error', text: 'Verbindungsfehler. Bitte versuchen Sie es erneut.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePdfDriverSearch = async (value: string) => {
    setPdfDriver(value);
    if (pdfSearchTimeout) clearTimeout(pdfSearchTimeout);

    if (value.trim().length > 0) {
      try {
        const data = await apiCall('admin-drivers', { method: 'GET' });
        const filtered = data.drivers.filter((d: Driver) =>
          d.name.toLowerCase().includes(value.toLowerCase()) ||
          d.code.toString().includes(value)
        );
        setPdfDriverSuggestions(filtered);
      } catch (error) {
        setPdfDriverSuggestions([]);
      }
    } else {
      setPdfDriverSuggestions([]);
    }
  };

  const handleCompareDriver1Search = async (value: string) => {
    setCompareDriver1(value);
    if (compareTimeout1) clearTimeout(compareTimeout1);

    if (value.trim().length > 0) {
      try {
        const data = await apiCall('admin-drivers', { method: 'GET' });
        const filtered = data.drivers.filter((d: Driver) =>
          d.name.toLowerCase().includes(value.toLowerCase()) ||
          d.code.toString().includes(value)
        );
        setCompareDriver1Suggestions(filtered);
      } catch (error) {
        setCompareDriver1Suggestions([]);
      }
    } else {
      setCompareDriver1Suggestions([]);
    }
  };

  const handleCompareDriver2Search = async (value: string) => {
    setCompareDriver2(value);
    if (compareTimeout2) clearTimeout(compareTimeout2);

    if (value.trim().length > 0) {
      try {
        const data = await apiCall('admin-drivers', { method: 'GET' });
        const filtered = data.drivers.filter((d: Driver) =>
          d.name.toLowerCase().includes(value.toLowerCase()) ||
          d.code.toString().includes(value)
        );
        setCompareDriver2Suggestions(filtered);
      } catch (error) {
        setCompareDriver2Suggestions([]);
      }
    } else {
      setCompareDriver2Suggestions([]);
    }
  };

  const generatePDF = async () => {
    if (!pdfDriver) {
      setMessage({ type: 'error', text: 'Bitte Fahrer auswählen' });
      return;
    }

    let fromDate = '';
    let toDate = '';

    if (pdfDateRange === 'custom') {
      if (!pdfFromDate || !pdfToDate) {
        setMessage({ type: 'error', text: 'Bitte Datumsbereich auswählen' });
        return;
      }
      fromDate = pdfFromDate;
      toDate = pdfToDate;
    } else {
      const today = new Date();
      if (pdfDateRange === 'lastWeek') {
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        fromDate = lastWeek.toISOString().split('T')[0];
        toDate = today.toISOString().split('T')[0];
      } else if (pdfDateRange === 'lastMonth') {
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        fromDate = lastMonth.toISOString().split('T')[0];
        toDate = lastMonthEnd.toISOString().split('T')[0];
      } else if (pdfDateRange === 'lastYear') {
        fromDate = `${today.getFullYear() - 1}-01-01`;
        toDate = `${today.getFullYear() - 1}-12-31`;
      }
    }

    setLoading(true);
    setMessage({ type: 'success', text: 'PDF wird erstellt...' });

    try {
      const data = await apiCall(`admin-reports?type=daterange&driver=${pdfDriver}&from_date=${fromDate}&to_date=${toDate}`, {
        method: 'GET'
      });

      if (data.driver) {
        generatePDFDocument(data.driver, fromDate, toDate);
        setMessage({ type: 'success', text: 'PDF wurde heruntergeladen' });
      } else {
        setMessage({ type: 'error', text: 'Keine Daten gefunden' });
      }
    } catch (error: any) {
      console.error('PDF generation error:', error);
      setMessage({ type: 'error', text: error.message || 'PDF-Export fehlgeschlagen' });
    } finally {
      setLoading(false);
    }
  };

  const generatePDFDocument = (driverData: any, fromDate: string, toDate: string) => {
    try {
      const doc = new jsPDF();

      const formatDateDE = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-');
        return `${day}.${month}.${year}`;
      };

      doc.setFontSize(20);
      doc.text('Fahrerabrechnung', 105, 20, { align: 'center' });

      doc.setFontSize(12);
      let yPos = 40;

      doc.setFont('helvetica', 'bold');
      doc.text('Fahrer Name:', 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(driverData.name, 70, yPos);
      yPos += 8;

      doc.setFont('helvetica', 'bold');
      doc.text('Fahrer Code:', 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(driverData.code.toString(), 70, yPos);
      yPos += 8;

      doc.setFont('helvetica', 'bold');
      doc.text('Zeitraum:', 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(`${formatDateDE(fromDate)} bis ${formatDateDE(toDate)}`, 70, yPos);
      yPos += 15;

      doc.setFillColor(243, 244, 246);
      doc.rect(20, yPos, 50, 20, 'F');
      doc.rect(80, yPos, 50, 20, 'F');
      doc.rect(140, yPos, 50, 20, 'F');

      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text('Arbeitstage', 25, yPos + 6);
      doc.text('Gesamtarbeitszeit', 85, yPos + 6);
      doc.text('Überstunden', 145, yPos + 6);

      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(driverData.days_worked.toString(), 25, yPos + 15);
      doc.text(formatMinutesToHHMM(driverData.total_duration_minutes), 85, yPos + 15);
      doc.text(formatMinutesToHHMM(driverData.total_overtime_minutes), 145, yPos + 15);

      yPos += 30;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(243, 244, 246);
      doc.rect(20, yPos, 170, 8, 'F');
      doc.text('Datum', 25, yPos + 6);
      doc.text('Fahrzeug', 50, yPos + 6);
      doc.text('Von', 75, yPos + 6);
      doc.text('Bis', 100, yPos + 6);
      doc.text('Arbeitszeit', 120, yPos + 6);
      doc.text('Überstunden', 155, yPos + 6);

      yPos += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      if (driverData.logs && driverData.logs.length > 0) {
        driverData.logs.forEach((log: any) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }

          doc.text(formatDateDE(log.date), 25, yPos);
          doc.text(normalizeVehicleNumber(log.car_number) || '-', 50, yPos);
          doc.text(log.start_time ? log.start_time.substring(0, 5) : '-', 75, yPos);
          doc.text(log.end_time ? log.end_time.substring(0, 5) : '-', 100, yPos);
          doc.text(formatMinutesToHHMM(log.duration_minutes), 120, yPos);
          doc.text(formatMinutesToHHMM(log.overtime_minutes), 155, yPos);

          yPos += 7;
        });
      } else {
        doc.text('Keine Einträge', 25, yPos);
        yPos += 7;
      }

      yPos += 10;
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      doc.text(`Erstellt am: ${today}`, 105, yPos, { align: 'center' });

      const filename = `Fahrerabrechnung_${driverData.name.replace(/\s/g, '_')}_${fromDate}_${toDate}.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error('PDF generation error:', error);
      throw new Error('PDF-Erstellung fehlgeschlagen');
    }
  };

  const loadComparison = async () => {
    if (!compareDriver1 || !compareDriver2 || !compareYear || !compareMonth) {
      return;
    }

    setLoading(true);
    try {
      const [data1, data2] = await Promise.all([
        apiCall(`admin-reports?type=monthly&driver=${compareDriver1}&year=${compareYear}&month=${compareMonth}`, {
          method: 'GET'
        }),
        apiCall(`admin-reports?type=monthly&driver=${compareDriver2}&year=${compareYear}&month=${compareMonth}`, {
          method: 'GET'
        })
      ]);

      if (data1.driver && data2.driver) {
        const driver1Data = data1.driver;
        const driver2Data = data2.driver;

        const workTimeDiff = driver1Data.total_duration_minutes - driver2Data.total_duration_minutes;
        const workTimePercent = driver2Data.total_duration_minutes > 0
          ? Math.round((workTimeDiff / driver2Data.total_duration_minutes) * 100)
          : 0;

        setComparisonData({
          driver1: driver1Data,
          driver2: driver2Data,
          workTimeDiff,
          workTimePercent
        });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDriverSearchChange = async (value: string) => {
    setSelectedDriverForReport(value);

    if (driverSearchTimeout) {
      clearTimeout(driverSearchTimeout);
    }

    if (value.length > 0) {
      try {
        const allDrivers = await apiCall('admin-drivers');
        const filtered = (allDrivers.drivers || []).filter((d: Driver) =>
          d.code.toString().includes(value) ||
          d.name.toLowerCase().includes(value.toLowerCase())
        );
        setDriverSuggestions(filtered);
      } catch (error) {
        setDriverSuggestions([]);
      }

      const timeout = setTimeout(() => {
        loadReports();
      }, 350);
      setDriverSearchTimeout(timeout);
    } else {
      setDriverSuggestions([]);
      setReportData(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'drivers') loadDrivers();
    else if (activeTab === 'logs') {
      setLogs([]);
      if (allVehicles.length === 0) {
        loadAllVehicles();
      }
    }
    else if (activeTab === 'reports') {
      loadTodayEntries();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'reports' && selectedDriverForReport && monthlyYear && monthlyMonth) {
      loadReports();
    }
  }, [monthlyYear, monthlyMonth]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.vehicle-autocomplete')) {
        setShowVehicleDropdown(false);
        setSelectedVehicleIndex(-1);
      }
    };

    if (showVehicleDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showVehicleDropdown]);

  useEffect(() => {
    if (message && message.type === 'success') {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiCall('admin-drivers', {
        method: 'POST',
        body: JSON.stringify(driverForm),
      });
      setMessage({ type: 'success', text: 'Fahrer erfolgreich hinzugefügt' });
      setDriverForm({ code: '', name: '', active: true });
      await loadDrivers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const startEditDriver = (driver: Driver) => {
    setEditingDriver(driver.code);
    setEditDriverForm({ code: driver.code.toString(), name: driver.name });
  };

  const cancelEditDriver = () => {
    setEditingDriver(null);
    setEditDriverForm({ code: '', name: '' });
  };

  const saveEditDriver = async (oldCode: number) => {
    if (!editDriverForm.name.trim()) {
      setMessage({ type: 'error', text: 'Name ist erforderlich' });
      return;
    }

    const newCode = parseInt(editDriverForm.code);
    if (isNaN(newCode) || newCode <= 0) {
      setMessage({ type: 'error', text: 'Ungültiger Code' });
      return;
    }

    if (newCode !== oldCode) {
      setConfirmCodeChange({
        show: true,
        oldCode,
        newCode: editDriverForm.code,
        name: editDriverForm.name.trim()
      });
      return;
    }

    setLoading(true);
    try {
      await apiCall('admin-drivers', {
        method: 'PATCH',
        body: JSON.stringify({
          code: oldCode,
          name: editDriverForm.name.trim()
        }),
      });
      setMessage({ type: 'success', text: 'Fahrer aktualisiert' });
      setEditingDriver(null);
      setEditDriverForm({ code: '', name: '' });
      await loadDrivers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const confirmCodeChangeAction = async () => {
    if (!confirmCodeChange) return;

    setLoading(true);
    try {
      await apiCall('admin-drivers', {
        method: 'PATCH',
        body: JSON.stringify({
          code: confirmCodeChange.oldCode,
          newCode: parseInt(confirmCodeChange.newCode),
          name: confirmCodeChange.name
        }),
      });
      setMessage({ type: 'success', text: 'Fahrercode wurde aktualisiert' });
      setConfirmCodeChange(null);
      setEditingDriver(null);
      setEditDriverForm({ code: '', name: '' });
      await loadDrivers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntryDriverSearch = async (value: string) => {
    setManualEntryForm({ ...manualEntryForm, driver: value });
    if (manualEntryTimeout) clearTimeout(manualEntryTimeout);

    if (value.trim().length > 0) {
      try {
        const data = await apiCall('admin-drivers', { method: 'GET' });
        const filtered = data.drivers.filter((d: Driver) =>
          d.name.toLowerCase().includes(value.toLowerCase()) ||
          d.code.toString().includes(value)
        );
        setManualEntryDriverSuggestions(filtered);
      } catch (error) {
        setManualEntryDriverSuggestions([]);
      }
    } else {
      setManualEntryDriverSuggestions([]);
    }
  };

  const handleManualEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!manualEntryForm.driver || !manualEntryForm.vehicle || !manualEntryForm.date || !manualEntryForm.startTime || !manualEntryForm.endTime) {
      setMessage({ type: 'error', text: 'Bitte füllen Sie alle Pflichtfelder aus' });
      return;
    }

    setLoading(true);
    try {
      await apiCall('admin-logs', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          driverCode: manualEntryForm.driver,
          vehicle: manualEntryForm.vehicle,
          date: manualEntryForm.date,
          startTime: manualEntryForm.startTime,
          endTime: manualEntryForm.endTime,
          pauseMinutes: manualEntryForm.pauseMinutes ? parseInt(manualEntryForm.pauseMinutes) : 0,
          note: manualEntryForm.note,
          forceCreate: manualEntryForm.forceCreate
        }),
      });
      setMessage({ type: 'success', text: 'Eintrag gespeichert' });
      setManualEntryForm({
        driver: '',
        vehicle: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '',
        endTime: '',
        pauseMinutes: '',
        note: '',
        forceCreate: false
      });
      await loadTodayEntries();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDriver = async (code: number, updates: Partial<Driver>) => {
    setLoading(true);
    try {
      await apiCall('admin-drivers', {
        method: 'PATCH',
        body: JSON.stringify({ code, ...updates }),
      });
      setMessage({ type: 'success', text: 'Fahrer aktualisiert' });
      setEditingDriver(null);
      await loadDrivers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDriver = async (driver: Driver) => {
    setConfirmDeleteDriver({ show: true, driver });
  };

  const confirmDeleteDriverAction = async () => {
    if (!confirmDeleteDriver.driver) return;

    const code = confirmDeleteDriver.driver.code;
    setLoading(true);
    try {
      await apiCall('admin-drivers', {
        method: 'DELETE',
        body: JSON.stringify({ code, force: true }),
      });
      setMessage({ type: 'success', text: 'Fahrer und alle zugehörigen Einträge wurden gelöscht' });
      setConfirmDeleteDriver({ show: false, driver: null });
      await loadDrivers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async (id: number) => {
    setConfirmDeleteEntry({ show: true, entryId: id });
  };

  const confirmDeleteEntryAction = async () => {
    if (!confirmDeleteEntry.entryId) return;

    const id = confirmDeleteEntry.entryId;
    setLoading(true);
    try {
      await apiCall('admin-logs', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', id }),
      });
      setMessage({ type: 'success', text: 'Eintrag wurde gelöscht' });
      setConfirmDeleteEntry({ show: false, entryId: null });
      await loadLogs();
      await loadTodayEntries();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const exportMonthlyCSV = () => {
    if (!reportData?.driver) return;

    const rows = [
      ['Datum', 'Arbeitszeit (H:MM)', 'Überstunden (H:MM)'],
      ...reportData.driver.logs.map((log: any) => [
        log.date,
        formatMinutesToHHMM(log.duration_minutes),
        formatMinutesToHHMM(log.overtime_minutes),
      ]),
      [],
      ['Gesamt', formatMinutesToHHMM(reportData.driver.total_duration_minutes), formatMinutesToHHMM(reportData.driver.total_overtime_minutes)],
    ];

    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monatsbericht-${reportData.driver.name}-${monthlyYear}-${monthlyMonth}.csv`;
    a.click();
  };

  const tabs = [
    { id: 'reports' as Tab, label: 'Berichte', icon: BarChart3 },
    { id: 'logs' as Tab, label: 'Einträge', icon: FileText },
    { id: 'drivers' as Tab, label: 'Fahrer', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Admin-Dashboard</h1>
              <p className="text-xs sm:text-sm text-gray-600">Fahrer-Arbeitszeitverwaltung</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPasswordChange(true)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition text-sm sm:text-base"
              >
                <Key className="w-4 h-4" />
                <span className="hidden sm:inline">Passwort ändern</span>
              </button>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition text-sm sm:text-base"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Abmelden</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border mb-6 overflow-hidden">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 font-medium text-xs sm:text-sm whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'drivers' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-4">Neuen Fahrer hinzufügen</h2>
              <form onSubmit={handleAddDriver} className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <input
                  type="number"
                  placeholder="Code (z.B. 1)"
                  value={driverForm.code}
                  onChange={(e) => setDriverForm({ ...driverForm, code: e.target.value })}
                  className="w-full sm:w-auto px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                  min="1"
                />
                <input
                  type="text"
                  placeholder="Name"
                  value={driverForm.name}
                  onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  Hinzufügen
                </button>
              </form>
            </div>

            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              {dataLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : drivers.length === 0 ? (
                <div className="text-center py-12 text-gray-500 px-4">
                  Keine Fahrer vorhanden. Fügen Sie den ersten Fahrer hinzu.
                </div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {drivers.map((driver) => (
                          <tr key={driver.code}>
                            {editingDriver === driver.code ? (
                              <>
                                <td className="px-6 py-4 text-sm font-mono">
                                  <input
                                    type="number"
                                    value={editDriverForm.code}
                                    onChange={(e) => setEditDriverForm({ ...editDriverForm, code: e.target.value })}
                                    className="px-2 py-1 border rounded w-full"
                                    disabled={loading}
                                    min="1"
                                  />
                                </td>
                                <td className="px-6 py-4 text-sm">
                                  <input
                                    type="text"
                                    value={editDriverForm.name}
                                    onChange={(e) => setEditDriverForm({ ...editDriverForm, name: e.target.value })}
                                    className="px-2 py-1 border rounded w-full"
                                    disabled={loading}
                                  />
                                </td>
                                <td className="px-6 py-4 text-sm">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs ${
                                      driver.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {driver.active ? 'Aktiv' : 'Inaktiv'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-right space-x-2">
                                  <button
                                    onClick={() => saveEditDriver(driver.code)}
                                    disabled={loading}
                                    className="text-green-600 hover:text-green-700 disabled:opacity-50 text-xs sm:text-sm"
                                  >
                                    Speichern
                                  </button>
                                  <button
                                    onClick={cancelEditDriver}
                                    disabled={loading}
                                    className="text-gray-600 hover:text-gray-700 disabled:opacity-50 text-xs sm:text-sm"
                                  >
                                    Abbrechen
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-6 py-4 text-sm font-mono">{driver.code}</td>
                                <td className="px-6 py-4 text-sm">{driver.name}</td>
                                <td className="px-6 py-4 text-sm">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs ${
                                      driver.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {driver.active ? 'Aktiv' : 'Inaktiv'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-right space-x-2">
                                  <button
                                    onClick={() => startEditDriver(driver)}
                                    disabled={loading}
                                    className="text-blue-600 hover:text-blue-700 disabled:opacity-50"
                                  >
                                    <Edit className="w-4 h-4 inline" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleUpdateDriver(driver.code, { active: !driver.active })
                                    }
                                    disabled={loading}
                                    className="text-blue-600 hover:text-blue-700 disabled:opacity-50 text-xs sm:text-sm"
                                  >
                                    {driver.active ? 'Deaktivieren' : 'Aktivieren'}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDriver(driver)}
                                    disabled={loading}
                                    className="text-red-600 hover:text-red-700 disabled:opacity-50"
                                  >
                                    <Trash2 className="w-4 h-4 inline" />
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden divide-y">
                    {drivers.map((driver) => (
                      <div key={driver.code} className="p-4 space-y-3">
                        {editingDriver === driver.code ? (
                          <>
                            <div className="space-y-2">
                              <label className="block text-sm font-medium text-gray-700">
                                Fahrercode
                              </label>
                              <input
                                type="number"
                                value={editDriverForm.code}
                                onChange={(e) => setEditDriverForm({ ...editDriverForm, code: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg"
                                disabled={loading}
                                min="1"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-medium text-gray-700">
                                Name
                              </label>
                              <input
                                type="text"
                                value={editDriverForm.name}
                                onChange={(e) => setEditDriverForm({ ...editDriverForm, name: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg"
                                disabled={loading}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEditDriver(driver.code)}
                                disabled={loading}
                                className="flex-1 px-3 py-2 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 disabled:opacity-50"
                              >
                                Speichern
                              </button>
                              <button
                                onClick={cancelEditDriver}
                                disabled={loading}
                                className="flex-1 px-3 py-2 text-sm bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                              >
                                Abbrechen
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold">{driver.name}</p>
                                <p className="text-sm text-gray-600 font-mono">Code: {driver.code}</p>
                              </div>
                              <span
                                className={`px-2 py-1 rounded-full text-xs ${
                                  driver.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {driver.active ? 'Aktiv' : 'Inaktiv'}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEditDriver(driver)}
                                disabled={loading}
                                className="px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  handleUpdateDriver(driver.code, { active: !driver.active })
                                }
                                disabled={loading}
                                className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                              >
                                {driver.active ? 'Deaktivieren' : 'Aktivieren'}
                              </button>
                              <button
                                onClick={() => handleDeleteDriver(driver)}
                                disabled={loading}
                                className="px-3 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-4">Filter</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Von *</label>
                    <input
                      type="date"
                      value={logFilters.from}
                      onChange={(e) => setLogFilters({ ...logFilters, from: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bis *</label>
                    <input
                      type="date"
                      value={logFilters.to}
                      onChange={(e) => setLogFilters({ ...logFilters, to: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Suche nach *</label>
                    <select
                      value={logFilters.searchMode}
                      onChange={(e) => setLogFilters({
                        ...logFilters,
                        searchMode: e.target.value as 'vehicle' | 'driver' | 'both',
                        vehicle: '',
                        driverSearch: ''
                      })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="vehicle">Fahrzeug</option>
                      <option value="driver">Fahrer</option>
                      <option value="both">Fahrzeug + Fahrer</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(logFilters.searchMode === 'vehicle' || logFilters.searchMode === 'both') && (
                    <div className="relative vehicle-autocomplete">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Fahrzeug *</label>
                      <input
                        type="text"
                        placeholder="Fahrzeug eingeben..."
                        value={logFilters.vehicle}
                        onChange={(e) => handleVehicleInputChange(e.target.value)}
                        onKeyDown={handleVehicleKeyDown}
                        onFocus={() => {
                          if (logFilters.vehicle && vehicleSuggestions.length > 0) {
                            setShowVehicleDropdown(true);
                          }
                        }}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      {showVehicleDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {vehicleSuggestions.length > 0 ? (
                            vehicleSuggestions.map((vehicle, index) => (
                              <button
                                key={vehicle}
                                type="button"
                                onClick={() => handleVehicleSelect(vehicle)}
                                className={`w-full px-4 py-2 text-left hover:bg-gray-100 transition ${
                                  index === selectedVehicleIndex ? 'bg-blue-50' : ''
                                }`}
                              >
                                {vehicle}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">
                              Kein Fahrzeug gefunden
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {(logFilters.searchMode === 'driver' || logFilters.searchMode === 'both') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Fahrer (Code oder Name) *</label>
                      <input
                        type="text"
                        placeholder="Code oder Name eingeben"
                        value={logFilters.driverSearch}
                        onChange={(e) => setLogFilters({ ...logFilters, driverSearch: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>

                <button
                  onClick={loadLogs}
                  disabled={dataLoading}
                  className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {dataLoading ? 'Lädt...' : 'Suchen'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              {dataLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 text-gray-500 px-4">
                  Keine Einträge gefunden. Fahrer können über die Startseite Einträge erstellen.
                </div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fahrer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fahrzeug</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Von</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bis</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dauer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Überstunden</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 text-sm">{log.work_date}</td>
                        <td className="px-6 py-4 text-sm">
                          {log.driver?.name || `Code ${log.driver_code}`}
                        </td>
                        <td className="px-6 py-4 text-sm">{normalizeVehicleNumber(log.car_number)}</td>
                        <td className="px-6 py-4 text-sm font-mono">
                          {log.start_time.substring(0, 5)}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono">
                          {log.end_time.substring(0, 5)}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono">
                          {formatMinutesToHHMM(log.duration_minutes)}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono">
                          {formatMinutesToHHMM(log.overtime_minutes)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right">
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden divide-y">
                    {logs.map((log) => (
                      <div key={log.id} className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{log.driver?.name || `Code ${log.driver_code}`}</p>
                            <p className="text-sm text-gray-600">{log.work_date}</p>
                          </div>
                          <span className="text-sm bg-gray-100 px-2 py-1 rounded">{normalizeVehicleNumber(log.car_number)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-gray-600">Von</p>
                            <p className="font-mono font-semibold">{log.start_time.substring(0, 5)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Bis</p>
                            <p className="font-mono font-semibold">{log.end_time.substring(0, 5)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Dauer</p>
                            <p className="font-mono font-semibold">{formatMinutesToHHMM(log.duration_minutes)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Überstunden</p>
                            <p className="font-mono font-semibold">{formatMinutesToHHMM(log.overtime_minutes)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteLog(log.id)}
                          disabled={loading}
                          className="w-full px-3 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Löschen
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-bold mb-6">Eintrag manuell hinzufügen</h2>
              <form onSubmit={handleManualEntrySubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fahrer (Code oder Name) *
                    </label>
                    <input
                      type="text"
                      placeholder="Code oder Name eingeben..."
                      value={manualEntryForm.driver}
                      onChange={(e) => handleManualEntryDriverSearch(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    {manualEntryDriverSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {manualEntryDriverSuggestions.map((driver) => (
                          <button
                            key={driver.code}
                            type="button"
                            onClick={() => {
                              setManualEntryForm({ ...manualEntryForm, driver: driver.code.toString() });
                              setManualEntryDriverSuggestions([]);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex justify-between items-center"
                          >
                            <span>{driver.name}</span>
                            <span className="text-sm text-gray-500">Code: {driver.code}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fahrzeug *
                    </label>
                    <input
                      type="text"
                      placeholder="z.B. LKW 01"
                      value={manualEntryForm.vehicle}
                      onChange={(e) => setManualEntryForm({ ...manualEntryForm, vehicle: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Datum *
                    </label>
                    <input
                      type="date"
                      value={manualEntryForm.date}
                      onChange={(e) => setManualEntryForm({ ...manualEntryForm, date: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pause (Minuten)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={manualEntryForm.pauseMinutes}
                      onChange={(e) => setManualEntryForm({ ...manualEntryForm, pauseMinutes: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      von (Startzeit) *
                    </label>
                    <input
                      type="time"
                      value={manualEntryForm.startTime}
                      onChange={(e) => setManualEntryForm({ ...manualEntryForm, startTime: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      bis (Endzeit) *
                    </label>
                    <input
                      type="time"
                      value={manualEntryForm.endTime}
                      onChange={(e) => setManualEntryForm({ ...manualEntryForm, endTime: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notiz
                  </label>
                  <textarea
                    placeholder="Optional..."
                    value={manualEntryForm.note}
                    onChange={(e) => setManualEntryForm({ ...manualEntryForm, note: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="forceCreate"
                    checked={manualEntryForm.forceCreate}
                    onChange={(e) => setManualEntryForm({ ...manualEntryForm, forceCreate: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="forceCreate" className="text-sm text-gray-700">
                    Trotzdem speichern (Admin) - Mehrere Einträge pro Tag erlauben
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Eintrag speichern
                </button>
              </form>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-bold mb-6">Monatsbericht</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fahrer auswählen (Code oder Name) *
                  </label>
                  <input
                    type="text"
                    placeholder="Code oder Name eingeben..."
                    value={selectedDriverForReport}
                    onChange={(e) => handleDriverSearchChange(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {driverSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {driverSuggestions.map((driver) => (
                        <button
                          key={driver.code}
                          onClick={() => {
                            setSelectedDriverForReport(driver.code.toString());
                            setDriverSuggestions([]);
                            if (driverSearchTimeout) clearTimeout(driverSearchTimeout);
                            const timeout = setTimeout(() => loadReports(), 350);
                            setDriverSearchTimeout(timeout);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 flex justify-between items-center"
                        >
                          <span>{driver.name}</span>
                          <span className="text-sm text-gray-500">Code: {driver.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Jahr</label>
                  <input
                    type="number"
                    placeholder="Jahr"
                    value={monthlyYear}
                    onChange={(e) => setMonthlyYear(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="2020"
                    max="2099"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Monat</label>
                  <input
                    type="number"
                    placeholder="Monat"
                    value={monthlyMonth}
                    onChange={(e) => setMonthlyMonth(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="12"
                  />
                </div>
              </div>

              {!selectedDriverForReport && (
                <div className="text-center py-8 text-gray-500 mb-6">
                  Bitte Fahrer auswählen
                </div>
              )}

              {dataLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-6 bg-gray-50 rounded-lg animate-pulse">
                      <div className="h-4 bg-gray-300 rounded w-24 mb-3"></div>
                      <div className="h-8 bg-gray-300 rounded w-32"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="p-6 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">Arbeitstage</p>
                      <p className="text-3xl font-bold">
                        {reportData?.driver?.days_worked ?? 0}
                      </p>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">Gesamtarbeitszeit</p>
                      <p className="text-3xl font-bold">
                        {reportData?.driver
                          ? formatMinutesToHHMM(reportData.driver.total_duration_minutes)
                          : '00:00'}
                      </p>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">Überstunden</p>
                      <p className="text-3xl font-bold">
                        {reportData?.driver
                          ? formatMinutesToHHMM(reportData.driver.total_overtime_minutes)
                          : '00:00'}
                      </p>
                    </div>
                  </div>

                  {reportData && reportData.driver && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                        <h3 className="text-lg font-semibold">
                          {reportData.driver.name} (Code: {reportData.driver.code})
                        </h3>
                        <button
                          onClick={exportMonthlyCSV}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          <Download className="w-4 h-4" />
                          CSV Export
                        </button>
                      </div>

                      {reportData.driver.logs && reportData.driver.logs.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Arbeitszeit</th>
                                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Überstunden</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {reportData.driver.logs.map((log: any, idx: number) => (
                                <tr key={idx}>
                                  <td className="px-4 sm:px-6 py-4 text-sm">{log.date}</td>
                                  <td className="px-4 sm:px-6 py-4 text-sm font-mono">
                                    {formatMinutesToHHMM(log.duration_minutes)}
                                  </td>
                                  <td className="px-4 sm:px-6 py-4 text-sm font-mono">
                                    {formatMinutesToHHMM(log.overtime_minutes)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-bold mb-6">Heutige Einträge</h2>
              {todayEntries.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  Keine Einträge für heute vorhanden.
                </div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fahrer</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fahrzeug</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Von</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bis</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Arbeitszeit</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Überstunden</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {todayEntries.map((entry) => (
                          <tr key={entry.id}>
                            <td className="px-4 py-3 text-sm">
                              <div>
                                <div className="font-medium">{entry.driver?.name || 'Unbekannt'}</div>
                                <div className="text-xs text-gray-500">Code: {entry.driver_code}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">{normalizeVehicleNumber(entry.car_number)}</td>
                            <td className="px-4 py-3 text-sm font-mono">{entry.start_time.substring(0, 5)}</td>
                            <td className="px-4 py-3 text-sm font-mono">{entry.end_time.substring(0, 5)}</td>
                            <td className="px-4 py-3 text-sm font-mono">{formatMinutesToHHMM(entry.duration_minutes)}</td>
                            <td className="px-4 py-3 text-sm font-mono">{formatMinutesToHHMM(entry.overtime_minutes)}</td>
                            <td className="px-4 py-3 text-sm text-right">
                              <button
                                onClick={() => handleDeleteLog(entry.id)}
                                disabled={loading}
                                className="text-red-600 hover:text-red-700 disabled:opacity-50"
                                title="Eintrag löschen"
                              >
                                <Trash2 className="w-4 h-4 inline" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden space-y-4">
                    {todayEntries.map((entry) => (
                      <div key={entry.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{entry.driver?.name || 'Unbekannt'}</p>
                            <p className="text-sm text-gray-600">Code: {entry.driver_code}</p>
                          </div>
                          <span className="text-sm bg-gray-100 px-2 py-1 rounded">{normalizeVehicleNumber(entry.car_number)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-gray-600">Von</p>
                            <p className="font-mono font-semibold">{entry.start_time.substring(0, 5)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Bis</p>
                            <p className="font-mono font-semibold">{entry.end_time.substring(0, 5)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Arbeitszeit</p>
                            <p className="font-mono font-semibold">{formatMinutesToHHMM(entry.duration_minutes)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Überstunden</p>
                            <p className="font-mono font-semibold">{formatMinutesToHHMM(entry.overtime_minutes)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteLog(entry.id)}
                          disabled={loading}
                          className="w-full px-3 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Eintrag löschen
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-bold mb-6">Fahrerabrechnung erstellen</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fahrer auswählen *
                  </label>
                  <input
                    type="text"
                    placeholder="Code oder Name eingeben..."
                    value={pdfDriver}
                    onChange={(e) => handlePdfDriverSearch(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {pdfDriverSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {pdfDriverSuggestions.map((driver) => (
                        <button
                          key={driver.code}
                          onClick={() => {
                            setPdfDriver(driver.code.toString());
                            setPdfDriverSuggestions([]);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 flex justify-between items-center"
                        >
                          <span>{driver.name}</span>
                          <span className="text-sm text-gray-500">Code: {driver.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Zeitraum *
                  </label>
                  <select
                    value={pdfDateRange}
                    onChange={(e) => setPdfDateRange(e.target.value as any)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="lastWeek">Letzte Woche</option>
                    <option value="lastMonth">Letzter Monat</option>
                    <option value="lastYear">Letztes Jahr</option>
                    <option value="custom">Benutzerdefiniert</option>
                  </select>
                </div>
              </div>

              {pdfDateRange === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Von *
                    </label>
                    <input
                      type="date"
                      value={pdfFromDate}
                      onChange={(e) => setPdfFromDate(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bis *
                    </label>
                    <input
                      type="date"
                      value={pdfToDate}
                      onChange={(e) => setPdfToDate(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={generatePDF}
                disabled={loading || !pdfDriver}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    PDF wird erstellt...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    PDF erstellen
                  </>
                )}
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-bold mb-6">Fahrer vergleichen</h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fahrer 1 *
                  </label>
                  <input
                    type="text"
                    placeholder="Code oder Name eingeben..."
                    value={compareDriver1}
                    onChange={(e) => handleCompareDriver1Search(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {compareDriver1Suggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {compareDriver1Suggestions.map((driver) => (
                        <button
                          key={driver.code}
                          onClick={() => {
                            setCompareDriver1(driver.code.toString());
                            setCompareDriver1Suggestions([]);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 flex justify-between items-center"
                        >
                          <span>{driver.name}</span>
                          <span className="text-sm text-gray-500">Code: {driver.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fahrer 2 *
                  </label>
                  <input
                    type="text"
                    placeholder="Code oder Name eingeben..."
                    value={compareDriver2}
                    onChange={(e) => handleCompareDriver2Search(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {compareDriver2Suggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {compareDriver2Suggestions.map((driver) => (
                        <button
                          key={driver.code}
                          onClick={() => {
                            setCompareDriver2(driver.code.toString());
                            setCompareDriver2Suggestions([]);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 flex justify-between items-center"
                        >
                          <span>{driver.name}</span>
                          <span className="text-sm text-gray-500">Code: {driver.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Jahr</label>
                  <input
                    type="number"
                    value={compareYear}
                    onChange={(e) => setCompareYear(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="2020"
                    max="2099"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Monat</label>
                  <input
                    type="number"
                    value={compareMonth}
                    onChange={(e) => setCompareMonth(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="12"
                  />
                </div>
              </div>

              <button
                onClick={loadComparison}
                disabled={loading || !compareDriver1 || !compareDriver2}
                className="mb-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Vergleichen
              </button>

              {comparisonData && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-4">{comparisonData.driver1.name}</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Arbeitstage:</span>
                          <span className="font-semibold">{comparisonData.driver1.days_worked}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Gesamtarbeitszeit:</span>
                          <span className="font-semibold">{formatMinutesToHHMM(comparisonData.driver1.total_duration_minutes)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Überstunden:</span>
                          <span className="font-semibold">{formatMinutesToHHMM(comparisonData.driver1.total_overtime_minutes)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-4">{comparisonData.driver2.name}</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Arbeitstage:</span>
                          <span className="font-semibold">{comparisonData.driver2.days_worked}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Gesamtarbeitszeit:</span>
                          <span className="font-semibold">{formatMinutesToHHMM(comparisonData.driver2.total_duration_minutes)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Überstunden:</span>
                          <span className="font-semibold">{formatMinutesToHHMM(comparisonData.driver2.total_overtime_minutes)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-center text-gray-800">
                      {comparisonData.workTimePercent > 0
                        ? `${comparisonData.driver1.name} hat ${Math.abs(comparisonData.workTimePercent)}% mehr Arbeitszeit als ${comparisonData.driver2.name} im ${getMonthName(parseInt(compareMonth))} ${compareYear}.`
                        : comparisonData.workTimePercent < 0
                        ? `${comparisonData.driver2.name} hat ${Math.abs(comparisonData.workTimePercent)}% mehr Arbeitszeit als ${comparisonData.driver1.name} im ${getMonthName(parseInt(compareMonth))} ${compareYear}.`
                        : `Beide Fahrer haben die gleiche Arbeitszeit im ${getMonthName(parseInt(compareMonth))} ${compareYear}.`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showPasswordChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Passwort ändern</h2>
              <button
                onClick={() => {
                  setShowPasswordChange(false);
                  setPasswordForm({ current: '', newPassword: '', confirmPassword: '' });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aktuelles Passwort
                </label>
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Neues Passwort
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                  minLength={8}
                />
                <p className="text-xs text-gray-500 mt-1">Mindestens 8 Zeichen</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Neues Passwort bestätigen
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordChange(false);
                    setPasswordForm({ current: '', newPassword: '', confirmPassword: '' });
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Passwort ändern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteDriver.show && confirmDeleteDriver.driver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Fahrer wirklich löschen?</h2>
              <button
                onClick={() => setConfirmDeleteDriver({ show: false, driver: null })}
                className="text-gray-500 hover:text-gray-700"
                disabled={loading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                Dieser Fahrer hat bestehende Einträge. Beim Löschen werden alle zugehörigen Einträge ebenfalls gelöscht. Möchten Sie fortfahren?
              </p>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-semibold">{confirmDeleteDriver.driver.name}</p>
                <p className="text-sm text-gray-600">Code: {confirmDeleteDriver.driver.code}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteDriver({ show: false, driver: null })}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                disabled={loading}
              >
                Abbrechen
              </button>
              <button
                onClick={confirmDeleteDriverAction}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Löscht...' : 'Fahrer löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteEntry.show && confirmDeleteEntry.entryId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Eintrag löschen?</h2>
              <button
                onClick={() => setConfirmDeleteEntry({ show: false, entryId: null })}
                className="text-gray-500 hover:text-gray-700"
                disabled={loading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-700">
                Nach dem Löschen kann der Fahrer für diesen Tag erneut eintragen.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteEntry({ show: false, entryId: null })}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                disabled={loading}
              >
                Abbrechen
              </button>
              <button
                onClick={confirmDeleteEntryAction}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Löscht...' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmCodeChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Fahrercode ändern?</h2>
              <button
                onClick={() => setConfirmCodeChange(null)}
                className="text-gray-500 hover:text-gray-700"
                disabled={loading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                Alle bisherigen Einträge werden auf den neuen Fahrercode aktualisiert.
              </p>
              <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                <p className="text-sm">
                  <span className="font-semibold">Alter Code:</span> {confirmCodeChange.oldCode}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Neuer Code:</span> {confirmCodeChange.newCode}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmCodeChange(null)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                disabled={loading}
              >
                Abbrechen
              </button>
              <button
                onClick={confirmCodeChangeAction}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Ändert...' : 'Ändern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
