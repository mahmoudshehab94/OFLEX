import { useState, useEffect } from 'react';
import { LogOut, Users, Clock } from 'lucide-react';
import { supabase, Driver, WorkTime, DriverWithWorkTimes, hasSupabaseConfig } from '../lib/supabase';

interface AdminDashboardProps {
  onLogout: () => void;
}

type Tab = 'drivers' | 'worktimes';

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('drivers');
  const [drivers, setDrivers] = useState<DriverWithWorkTimes[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    if (!supabase) {
      setMessage({ type: 'error', text: 'Supabase not configured' });
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

  const calculateDuration = (start: string, end: string): string => {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}h ${minutes}m`;
  };

  if (!hasSupabaseConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 max-w-md">
          <h2 className="text-red-400 font-bold text-xl mb-2">Configuration Error</h2>
          <p className="text-red-300">
            Missing Supabase environment variables.
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
          <div className="flex border-b border-slate-700">
            <button
              onClick={() => setActiveTab('drivers')}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition ${
                activeTab === 'drivers'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Users className="w-5 h-5" />
              Fahrer ({drivers.length})
            </button>
            <button
              onClick={() => setActiveTab('worktimes')}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition ${
                activeTab === 'worktimes'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Clock className="w-5 h-5" />
              Arbeitszeiten
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
                    {drivers.length === 0 ? (
                      <p className="text-gray-400 text-center py-8">Keine Fahrer vorhanden</p>
                    ) : (
                      drivers.map((driver) => (
                        <div
                          key={driver.id}
                          className="bg-slate-700 rounded-lg p-4 border border-slate-600"
                        >
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
                            </div>
                            <div className="text-right">
                              <span className="text-blue-400 font-semibold">
                                {driver.work_times?.length || 0} Einträge
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'worktimes' && (
                  <div className="space-y-6">
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
                                .map((workTime) => (
                                  <div
                                    key={workTime.id}
                                    className="bg-slate-700 rounded-lg p-3 border border-slate-600"
                                  >
                                    <div className="grid grid-cols-3 gap-4 text-sm">
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
                                          {calculateDuration(workTime.start_time, workTime.end_time)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
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
