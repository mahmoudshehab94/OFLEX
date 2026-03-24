export interface MonthStats {
  arbeitstage: number;
  gesamtstunden: number;
  durchschnitt: number;
  entries: number;
  fehlendeTage: number;
  fehlendeTageList: number[];
  uberstunden: number;
  monthName: string;
  year: number;
  month: number;
}

export interface WorkEntryData {
  date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  vehicle?: string | null;
}

export const getMonthName = (monthIndex: number): string => {
  const months = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  return months[monthIndex];
};

export const calculateWorkHours = (startTime: string, endTime: string, breakMinutes: number = 0): number => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  if (totalMinutes < 0) totalMinutes += 24 * 60;

  totalMinutes -= breakMinutes;
  return totalMinutes / 60;
};

const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

const getSubmittedDates = (entries: WorkEntryData[]): Set<string> => {
  const submittedDates = new Set<string>();
  entries.forEach(entry => {
    const dateStr = entry.date;
    submittedDates.add(dateStr);
  });
  return submittedDates;
};

const getMissingWorkingDays = (year: number, month: number, submittedDates: Set<string>): { count: number; days: number[] } => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const today = now.getDate();

  const daysInMonth = getDaysInMonth(year, month);
  const missingDays: number[] = [];

  let lastDayToCheck = daysInMonth;
  if (year === currentYear && month === currentMonth) {
    lastDayToCheck = today;
  }

  for (let day = 1; day <= lastDayToCheck; day++) {
    const date = new Date(year, month - 1, day);

    if (isWeekend(date)) {
      continue;
    }

    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (!submittedDates.has(dateStr)) {
      missingDays.push(day);
    }
  }

  return { count: missingDays.length, days: missingDays };
};

export const calculateMonthStatistics = (
  entries: WorkEntryData[],
  year: number,
  month: number
): MonthStats => {
  const STANDARD_WORK_HOURS = 8;

  // Handle empty entries case - all working days in the month are missing
  if (!entries || entries.length === 0) {
    const missing = getMissingWorkingDays(year, month, new Set());
    return {
      arbeitstage: 0,
      gesamtstunden: 0,
      durchschnitt: 0,
      entries: 0,
      fehlendeTage: missing.count,
      fehlendeTageList: missing.days,
      uberstunden: 0,
      monthName: getMonthName(month - 1),
      year,
      month
    };
  }

  // Calculate total work hours across all entries
  const totalHours = entries.reduce((sum, entry) => {
    return sum + calculateWorkHours(entry.start_time, entry.end_time, entry.break_minutes || 0);
  }, 0);

  // Group entries by date and calculate overtime per day
  const entriesByDate: Record<string, WorkEntryData[]> = {};
  entries.forEach(entry => {
    if (!entriesByDate[entry.date]) {
      entriesByDate[entry.date] = [];
    }
    entriesByDate[entry.date].push(entry);
  });

  // Calculate overtime (hours over 8 per day)
  let totalOvertime = 0;
  Object.values(entriesByDate).forEach(dayEntries => {
    const dayTotal = dayEntries.reduce((sum, entry) => {
      return sum + calculateWorkHours(entry.start_time, entry.end_time, entry.break_minutes || 0);
    }, 0);

    if (dayTotal > STANDARD_WORK_HOURS) {
      totalOvertime += dayTotal - STANDARD_WORK_HOURS;
    }
  });

  // Count unique days worked (multiple entries on same day count as one day)
  const uniqueDays = new Set(entries.map(e => e.date)).size;
  const avgHours = uniqueDays > 0 ? totalHours / uniqueDays : 0;

  // Get all dates that have submissions
  const submittedDates = getSubmittedDates(entries);

  // Calculate which working days are missing submissions
  const missing = getMissingWorkingDays(year, month, submittedDates);

  return {
    arbeitstage: uniqueDays,
    gesamtstunden: Math.round(totalHours * 10) / 10,
    durchschnitt: Math.round(avgHours * 10) / 10,
    entries: entries.length,
    fehlendeTage: missing.count,
    fehlendeTageList: missing.days,
    uberstunden: Math.round(totalOvertime * 10) / 10,
    monthName: getMonthName(month - 1),
    year,
    month
  };
};

export const getAvailableYears = (): number[] => {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let i = 0; i <= 10; i++) {
    years.push(currentYear - i);
  }
  return years;
};

export const getMonths = (): { value: number; label: string }[] => {
  return Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: getMonthName(i)
  }));
};
