import { useState, useEffect } from 'react';
import { ArrowLeft, Car, Snowflake } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BarcodeModal } from './BarcodeModal';

interface Vehicle {
  id: string;
  plate_letters: string;
  plate_number: string;
  vehicle_code_image_url: string | null;
  cooling_code_image_url: string | null;
  standard_code_image_url: string | null;
}

interface ScanPageProps {
  onBack: () => void;
}

export function ScanPage({ onBack }: ScanPageProps) {
  const { user } = useAuth();
  const [driverIdBarcodeUrl, setDriverIdBarcodeUrl] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(false);

  const [barcodeModal, setBarcodeModal] = useState<{
    isOpen: boolean;
    imageUrl: string;
    label: string;
  }>({
    isOpen: false,
    imageUrl: '',
    label: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedVehicleId) {
      const vehicle = vehicles.find(v => v.id === selectedVehicleId);
      setSelectedVehicle(vehicle || null);
    } else {
      setSelectedVehicle(null);
    }
  }, [selectedVehicleId, vehicles]);

  const loadData = async () => {
    if (!supabase || !user?.driver_id) return;

    try {
      const { data: driverData } = await supabase
        .from('drivers')
        .select('id_barcode_image_url')
        .eq('id', user.driver_id)
        .single();

      if (driverData) {
        setDriverIdBarcodeUrl(driverData.id_barcode_image_url);
      }

      const { data: vehiclesData } = await supabase
        .from('vehicles')
        .select('*')
        .order('plate_letters', { ascending: true })
        .order('plate_number', { ascending: true });

      if (vehiclesData) {
        setVehicles(vehiclesData);
      }
    } catch (error) {
      console.error('Error loading scan data:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Zurück</span>
              </button>
            </div>
            <h1 className="text-2xl font-bold text-white">Scan</h1>
          </div>

          <div className="p-4 space-y-3">
            <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
              <h3 className="text-base font-semibold text-white mb-3">Ausweiscode</h3>
              {driverIdBarcodeUrl ? (
                <div className="flex justify-center cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all rounded-lg p-2"
                  onClick={() => setBarcodeModal({
                    isOpen: true,
                    imageUrl: driverIdBarcodeUrl,
                    label: 'Scannen Sie diesen Code',
                  })}
                  title="Klicken für Vollbild"
                >
                  <img
                    src={driverIdBarcodeUrl}
                    alt="Driver ID Barcode"
                    className="max-w-full h-auto rounded-lg border-2 border-gray-600 max-h-48 object-contain"
                  />
                </div>
              ) : (
                <div className="bg-gray-600/50 rounded-lg p-4 text-center">
                  <p className="text-gray-300 text-sm">Kein Ausweiscode vorhanden.</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Bitte laden Sie Ihren Ausweiscode in den Einstellungen hoch.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
              <label htmlFor="vehicle" className="block text-sm font-medium text-gray-300 mb-2">
                Fahrzeug auswählen
              </label>
              <select
                id="vehicle"
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-600 border border-gray-500 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              >
                <option value="">-- Bitte wählen --</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.plate_letters} {vehicle.plate_number}
                  </option>
                ))}
              </select>
            </div>

            {selectedVehicle && (
              <>
                {selectedVehicle.vehicle_code_image_url ? (
                  <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <div className="flex items-center gap-2 mb-2">
                      <Car className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex justify-center cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all rounded-lg p-2"
                      onClick={() => setBarcodeModal({
                        isOpen: true,
                        imageUrl: selectedVehicle.vehicle_code_image_url!,
                        label: `${selectedVehicle.plate_letters} ${selectedVehicle.plate_number} - Fahrzeugcode`,
                      })}
                      title="Klicken für Vollbild"
                    >
                      <img
                        src={selectedVehicle.vehicle_code_image_url}
                        alt="Vehicle Code"
                        className="max-w-full h-auto rounded-lg border-2 border-gray-600 max-h-40 object-contain"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <div className="flex items-center gap-2 mb-2">
                      <Car className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="bg-gray-600/50 rounded-lg p-4 text-center">
                      <p className="text-gray-300 text-xs">Für dieses Fahrzeug fehlt das Code-Bild.</p>
                    </div>
                  </div>
                )}

                {selectedVehicle.cooling_code_image_url ? (
                  <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <div className="flex items-center gap-2 mb-2">
                      <Snowflake className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex justify-center cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all rounded-lg p-2"
                      onClick={() => setBarcodeModal({
                        isOpen: true,
                        imageUrl: selectedVehicle.cooling_code_image_url!,
                        label: `${selectedVehicle.plate_letters} ${selectedVehicle.plate_number} - Kühlcode`,
                      })}
                      title="Klicken für Vollbild"
                    >
                      <img
                        src={selectedVehicle.cooling_code_image_url}
                        alt="Cooling Code"
                        className="max-w-full h-auto rounded-lg border-2 border-gray-600 max-h-40 object-contain"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <div className="flex items-center gap-2 mb-2">
                      <Snowflake className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="bg-gray-600/50 rounded-lg p-4 text-center">
                      <p className="text-gray-300 text-xs">Für dieses Fahrzeug fehlt das Code-Bild.</p>
                    </div>
                  </div>
                )}

                {selectedVehicle.standard_code_image_url ? (
                  <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <div className="flex items-center gap-2 mb-2">
                      <Snowflake className="w-4 h-4 text-orange-400" />
                    </div>
                    <div className="flex justify-center cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all rounded-lg p-2"
                      onClick={() => setBarcodeModal({
                        isOpen: true,
                        imageUrl: selectedVehicle.standard_code_image_url!,
                        label: `${selectedVehicle.plate_letters} ${selectedVehicle.plate_number} - Standardcode`,
                      })}
                      title="Klicken für Vollbild"
                    >
                      <img
                        src={selectedVehicle.standard_code_image_url}
                        alt="Standard Code"
                        className="max-w-full h-auto rounded-lg border-2 border-gray-600 max-h-40 object-contain"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <div className="flex items-center gap-2 mb-2">
                      <Snowflake className="w-4 h-4 text-orange-400" />
                    </div>
                    <div className="bg-gray-600/50 rounded-lg p-4 text-center">
                      <p className="text-gray-300 text-xs">Für dieses Fahrzeug fehlt das Code-Bild.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <BarcodeModal
        isOpen={barcodeModal.isOpen}
        onClose={() => setBarcodeModal({ ...barcodeModal, isOpen: false })}
        imageUrl={barcodeModal.imageUrl}
        altText="Barcode"
        label={barcodeModal.label}
      />
    </div>
  );
}
