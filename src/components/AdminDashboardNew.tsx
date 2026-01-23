import { useState, useEffect } from 'react';
import { LogOut, Users, Edit2, Trash2, Save, X, Search, Power } from 'lucide-react';
import { supabase, Driver, hasSupabaseConfig } from '../lib/supabase';

interface AdminDashboardProps {
  onLogout: () => void;
}

interface DriverWithEntries extends Driver {
  entry_count?: number;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [drivers, setDrivers] = useState<DriverWithEntries[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<DriverWithEntries[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newDriverCode, setNewDriverCode] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDrivers();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredDrivers(drivers);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = drivers.filter(driver =>
      driver.driver_code.toLowerCase().includes(query) ||
      driver.driver_name.toLowerCase().includes(query)
    );
    setFilteredDrivers(filtered);
  }, [searchQuery, drivers]);

  const loadDrivers = async () => {
    if (!supabase) {
      setMessage({ type: 'error', text: 'Datenbank nicht konfiguriert' });
      return;
    }

    setLoading(true);
    try {
      const { data: driversData, error: driversError } = await supabase
        .from('drivers')
        .select('*')
        .order('driver_code', { ascending: true });

      if (driversError) {
        console.error('Load drivers error:', driversError);
        setMessage({ type: 'error', text: 'Fehler beim Laden der Fahrer' });
        setLoading(false);
        return;
      }

      const driversWithCounts = await Promise.all(
        (driversData || []).map(async (driver) => {
          const { count } = await supabase
            .from('work_entries')
            .select('*', { count: 'exact', head: true })
            .eq('driver_id', driver.id);

          return {
            ...driver,
            entry_count: count || 0
          };
        })
      );

      setDrivers(driversWithCounts);
      setFilteredDrivers(driversWithCounts);
    } catch (error: any) {
      console.error('Unexpected error:', error);
      setMessage({ type: 'error', text: 'Interner Serverfehler' });
    } finally {
      setLoading(false);
    }
  };

  const addDriver = async () => {
    if (!supabase) return;

    if (!newDriverCode.trim() || !newDriverName.trim()) {
      setMessage({ type: 'error', text: 'Bitte Code und Name eingeben' });
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
          setMessage({ type: 'error', text: 'Dieser Code ist bereits vergeben' });
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
      setMessage({ type: 'error', text: 'Code und Name sind erforderlich' });
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
          setMessage({ type: 'error', text: 'Dieser Code ist bereits vergeben' });
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

  const toggleDriverStatus = async (driver: Driver) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .update({ is_active: !driver.is_active })
        .eq('id', driver.id);

      if (error) {
        setMessage({ type: 'error', text: `Fehler: ${error.message}` });
      } else {
        setMessage({
          type: 'success',
          text: driver.is_active ? 'Fahrer deaktiviert' : 'Fahrer aktiviert'
        });
        loadDrivers();
      }
    } catch (error: any) {
      console.error('Toggle status error:', error);
      setMessage({ type: 'error', text: 'Fehler beim Ändern des Status' });
    }
  };

  const deleteDriver = async (driver: DriverWithEntries) => {
    if (!supabase) return;

    const entryCount = driver.entry_count || 0;
    const confirmMessage = entryCount > 0
      ? `Fahrer "${driver.driver_name}" wirklich löschen? Dies wird auch ${entryCount} Einträge löschen.`
      : `Fahrer "${driver.driver_name}" wirklich löschen?`;

    if (!confirm(confirmMessage)) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', driver.id);

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin-Dashboard</h1>
            <p className="text-gray-600">Fahrerverwaltung</p>
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

      {/* Main Content */}
      <div className="px-6 py-6 space-y-6">
        {/* Add Driver Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">Neuen Fahrer hinzufügen</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2">Code (eindeutig) *</label>
              <input
                type="text"
                value={newDriverCode}
                onChange={(e) => setNewDriverCode(e.target.value)}
                placeholder="z.B. 101, D001..."
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
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            Hinzufügen
          </button>
        </div>

        {/* Search and Drivers List */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Alle Fahrer</h2>

          {/* Search Box */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nach Code oder Name suchen..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {searchQuery && (
              <p className="mt-2 text-sm text-gray-600">
                {filteredDrivers.length} von {drivers.length} Fahrer(n) gefunden
              </p>
            )}
          </div>

          {/* Drivers List */}
          {loading ? (
            <p className="text-gray-500 text-center py-12">Lädt...</p>
          ) : filteredDrivers.length === 0 ? (
            <p className="text-gray-500 text-center py-12">
              {searchQuery ? 'Keine Fahrer gefunden' : 'Keine Fahrer vorhanden'}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredDrivers.map((driver) => (
                <div
                  key={driver.id}
                  className={`border rounded-lg p-4 ${
                    driver.is_active ? 'border-gray-200 bg-white' : 'border-gray-300 bg-gray-50'
                  }`}
                >
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
                        <p className={`font-semibold ${driver.is_active ? 'text-gray-900' : 'text-gray-500'}`}>
                          {driver.driver_name} (Code: {driver.driver_code})
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-sm text-gray-600">
                            Einträge: {driver.entry_count || 0}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            driver.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {driver.is_active ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleDriverStatus(driver)}
                          className={`p-2 rounded ${
                            driver.is_active
                              ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                              : 'bg-green-100 text-green-600 hover:bg-green-200'
                          }`}
                          title={driver.is_active ? 'Deaktivieren' : 'Aktivieren'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => startEditDriver(driver)}
                          className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                          title="Bearbeiten"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteDriver(driver)}
                          className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"
                          title="Löschen"
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
    </div>
  );
}
