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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 max-w-md w-full">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Monat auswählen</h3>
                <button
                  onClick={handleCancel}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">Jahr</label>
                  <select
                    value={tempYear}
                    onChange={(e) => setTempYear(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  >
                    {years.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">Monat</label>
                  <div className="grid grid-cols-3 gap-2">
                    {months.map(month => (
                      <button
                        key={month.value}
                        onClick={() => setTempMonth(month.value)}
                        className={`px-4 py-3 rounded-lg font-medium transition-all ${
                          tempMonth === month.value
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {month.label.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-700 flex gap-3">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Monat auswählen</h3>
              <button
                onClick={handleCancel}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Jahr</label>
                <select
                  value={tempYear}
                  onChange={(e) => setTempYear(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Monat</label>
                <div className="grid grid-cols-3 gap-2">
                  {months.map(month => (
                    <button
                      key={month.value}
                      onClick={() => setTempMonth(month.value)}
                      className={`px-4 py-3 rounded-lg font-medium transition-all ${
                        tempMonth === month.value
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {month.label.substring(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleApply}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
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
