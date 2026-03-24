import { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { getAvailableYears, getMonths } from '../lib/statisticsUtils';

interface MonthSelectorProps {
  selectedYear: number;
  selectedMonth: number;
  onMonthChange: (year: number, month: number) => void;
  variant?: 'driver' | 'admin';
}

export function MonthSelector({ selectedYear, selectedMonth, onMonthChange, variant = 'driver' }: MonthSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempYear, setTempYear] = useState(selectedYear);
  const [tempMonth, setTempMonth] = useState(selectedMonth);

  const years = getAvailableYears();
  const months = getMonths();

  const handleApply = () => {
    onMonthChange(tempYear, tempMonth);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTempYear(selectedYear);
    setTempMonth(selectedMonth);
    setIsOpen(false);
  };

  const currentMonthName = months.find(m => m.value === selectedMonth)?.label || '';

  if (variant === 'driver') {
    return (
      <>
        <div
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-1">{currentMonthName} {selectedYear}</h2>
              <p className="text-blue-100">Monatsstatistik</p>
            </div>
            <Calendar className="w-8 h-8 text-white/80" />
          </div>
        </div>

        {isOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="backdrop-blur-xl bg-slate-800/90 rounded-2xl shadow-2xl border border-white/10 max-w-md w-full">
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Monat auswählen</h3>
                <button
                  onClick={handleCancel}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-3">Jahr</label>
                  <select
                    value={tempYear}
                    onChange={(e) => setTempYear(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  >
                    {years.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-3">Monat</label>
                  <div className="grid grid-cols-3 gap-2">
                    {months.map(month => (
                      <button
                        key={month.value}
                        onClick={() => setTempMonth(month.value)}
                        className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                          tempMonth === month.value
                            ? 'bg-blue-500 text-white shadow-lg ring-2 ring-blue-400'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-white/10'
                        }`}
                      >
                        {month.label.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-white/10 flex gap-3">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-6 py-3 bg-slate-700/50 text-white rounded-lg font-semibold hover:bg-slate-600/50 transition-colors border border-white/10"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                >
                  Übernehmen
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div
        onClick={() => setIsOpen(true)}
        className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 text-white cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{currentMonthName} {selectedYear}</h3>
            <p className="text-blue-100 text-sm">Monatsstatistik</p>
          </div>
          <Calendar className="w-6 h-6 text-white/80" />
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="backdrop-blur-xl bg-slate-800/90 rounded-2xl shadow-2xl border border-white/10 max-w-md w-full">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Monat auswählen</h3>
              <button
                onClick={handleCancel}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-3">Jahr</label>
                <select
                  value={tempYear}
                  onChange={(e) => setTempYear(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-3">Monat</label>
                <div className="grid grid-cols-3 gap-2">
                  {months.map(month => (
                    <button
                      key={month.value}
                      onClick={() => setTempMonth(month.value)}
                      className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                        tempMonth === month.value
                          ? 'bg-blue-500 text-white shadow-lg ring-2 ring-blue-400'
                          : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-white/10'
                      }`}
                    >
                      {month.label.substring(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/10 flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 px-6 py-3 bg-slate-700/50 text-white rounded-lg font-semibold hover:bg-slate-600/50 transition-colors border border-white/10"
              >
                Abbrechen
              </button>
              <button
                onClick={handleApply}
                className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
              >
                Übernehmen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
