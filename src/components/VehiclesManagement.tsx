import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Car, Plus, Pencil, Trash2, Search, X, Upload, Image as ImageIcon, Snowflake, AlertCircle, Loader2 } from 'lucide-react';

interface Vehicle {
  id: string;
  plate_letters: string;
  plate_number: string;
  vehicle_code_image_url: string;
  cooling_code_image_url: string;
  standard_code_image_url: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  type: 'success' | 'error';
  text: string;
}

export default function VehiclesManagement() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Message | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    plate_letters: '',
    plate_number: '',
  });

  const [barcodeImages, setBarcodeImages] = useState<{
    vehicle_code: File | null;
    cooling_code: File | null;
    standard_code: File | null;
  }>({
    vehicle_code: null,
    cooling_code: null,
    standard_code: null,
  });

  const [previewUrls, setPreviewUrls] = useState<{
    vehicle_code: string | null;
    cooling_code: string | null;
    standard_code: string | null;
  }>({
    vehicle_code: null,
    cooling_code: null,
    standard_code: null,
  });

  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredVehicles(vehicles);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = vehicles.filter(vehicle =>
        vehicle.plate_letters.toLowerCase().includes(query) ||
        vehicle.plate_number.toLowerCase().includes(query) ||
        `${vehicle.plate_letters} ${vehicle.plate_number}`.toLowerCase().includes(query)
      );
      setFilteredVehicles(filtered);
    }
  }, [searchQuery, vehicles]);

  const loadVehicles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('plate_letters', { ascending: true })
        .order('plate_number', { ascending: true });

      if (error) throw error;
      setVehicles(data || []);
      setFilteredVehicles(data || []);
    } catch (error: any) {
      showMessage('error', 'Fehler beim Laden der Fahrzeuge: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleImageSelect = (type: 'vehicle_code' | 'cooling_code' | 'standard_code', file: File) => {
    setBarcodeImages(prev => ({ ...prev, [type]: file }));

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrls(prev => ({ ...prev, [type]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleImageRemove = (type: 'vehicle_code' | 'cooling_code' | 'standard_code') => {
    setBarcodeImages(prev => ({ ...prev, [type]: null }));
    setPreviewUrls(prev => ({ ...prev, [type]: null }));
  };

  const uploadImage = async (file: File, vehicleId: string, type: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${vehicleId}/${type}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from('vehicle-barcodes')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('vehicle-barcodes')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const deleteImage = async (url: string) => {
    try {
      const path = url.split('/vehicle-barcodes/')[1];
      if (path) {
        await supabase.storage
          .from('vehicle-barcodes')
          .remove([path]);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.plate_letters.trim() || !formData.plate_number.trim()) {
      showMessage('error', 'Bitte Buchstaben und Nummer eingeben');
      return;
    }

    if (editingVehicle) {
      const hasNewImages = barcodeImages.vehicle_code || barcodeImages.cooling_code || barcodeImages.standard_code;
      const hasExistingImages = editingVehicle.vehicle_code_image_url &&
                                editingVehicle.cooling_code_image_url &&
                                editingVehicle.standard_code_image_url;

      if (!hasNewImages && !hasExistingImages) {
        showMessage('error', 'Bitte alle 3 Barcode-Bilder hochladen');
        return;
      }
    } else {
      if (!barcodeImages.vehicle_code || !barcodeImages.cooling_code || !barcodeImages.standard_code) {
        showMessage('error', 'Bitte alle 3 Barcode-Bilder hochladen');
        return;
      }
    }

    try {
      setUploading(true);

      if (editingVehicle) {
        let vehicleCodeUrl = editingVehicle.vehicle_code_image_url;
        let coolingCodeUrl = editingVehicle.cooling_code_image_url;
        let standardCodeUrl = editingVehicle.standard_code_image_url;

        if (barcodeImages.vehicle_code) {
          if (vehicleCodeUrl) await deleteImage(vehicleCodeUrl);
          vehicleCodeUrl = await uploadImage(barcodeImages.vehicle_code, editingVehicle.id, 'vehicle_code');
        }

        if (barcodeImages.cooling_code) {
          if (coolingCodeUrl) await deleteImage(coolingCodeUrl);
          coolingCodeUrl = await uploadImage(barcodeImages.cooling_code, editingVehicle.id, 'cooling_code');
        }

        if (barcodeImages.standard_code) {
          if (standardCodeUrl) await deleteImage(standardCodeUrl);
          standardCodeUrl = await uploadImage(barcodeImages.standard_code, editingVehicle.id, 'standard_code');
        }

        const { error } = await supabase
          .from('vehicles')
          .update({
            plate_letters: formData.plate_letters.trim().toUpperCase(),
            plate_number: formData.plate_number.trim(),
            vehicle_code_image_url: vehicleCodeUrl,
            cooling_code_image_url: coolingCodeUrl,
            standard_code_image_url: standardCodeUrl,
          })
          .eq('id', editingVehicle.id);

        if (error) throw error;
        showMessage('success', 'Fahrzeug erfolgreich aktualisiert');
      } else {
        const tempId = crypto.randomUUID();

        const vehicleCodeUrl = await uploadImage(barcodeImages.vehicle_code!, tempId, 'vehicle_code');
        const coolingCodeUrl = await uploadImage(barcodeImages.cooling_code!, tempId, 'cooling_code');
        const standardCodeUrl = await uploadImage(barcodeImages.standard_code!, tempId, 'standard_code');

        const { error } = await supabase
          .from('vehicles')
          .insert({
            id: tempId,
            plate_letters: formData.plate_letters.trim().toUpperCase(),
            plate_number: formData.plate_number.trim(),
            vehicle_code_image_url: vehicleCodeUrl,
            cooling_code_image_url: coolingCodeUrl,
            standard_code_image_url: standardCodeUrl,
          });

        if (error) throw error;
        showMessage('success', 'Fahrzeug erfolgreich hinzugefügt');
      }

      resetForm();
      loadVehicles();
    } catch (error: any) {
      showMessage('error', 'Fehler: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      plate_letters: vehicle.plate_letters,
      plate_number: vehicle.plate_number,
    });
    setPreviewUrls({
      vehicle_code: vehicle.vehicle_code_image_url,
      cooling_code: vehicle.cooling_code_image_url,
      standard_code: vehicle.standard_code_image_url,
    });
    setBarcodeImages({
      vehicle_code: null,
      cooling_code: null,
      standard_code: null,
    });
    setShowForm(true);
  };

  const handleDelete = async (vehicleId: string) => {
    try {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (!vehicle) return;

      await deleteImage(vehicle.vehicle_code_image_url);
      await deleteImage(vehicle.cooling_code_image_url);
      await deleteImage(vehicle.standard_code_image_url);

      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', vehicleId);

      if (error) throw error;

      showMessage('success', 'Fahrzeug erfolgreich gelöscht');
      loadVehicles();
    } catch (error: any) {
      showMessage('error', 'Fehler beim Löschen: ' + error.message);
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  const resetForm = () => {
    setFormData({ plate_letters: '', plate_number: '' });
    setBarcodeImages({ vehicle_code: null, cooling_code: null, standard_code: null });
    setPreviewUrls({ vehicle_code: null, cooling_code: null, standard_code: null });
    setEditingVehicle(null);
    setShowForm(false);
  };

  const ImageUploadSection = ({
    type,
    label,
    icon
  }: {
    type: 'vehicle_code' | 'cooling_code' | 'standard_code';
    label: string;
    icon?: React.ReactNode;
  }) => {
    const hasImage = previewUrls[type] !== null;
    const hasNewImage = barcodeImages[type] !== null;

    return (
      <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
        {(label || icon) && (
          <div className="flex items-center gap-2 mb-4">
            {label && <span className="font-medium text-white">{label}</span>}
            {icon}
          </div>
        )}

        {hasImage ? (
          <div className="space-y-3">
            <div className="relative bg-white rounded-lg p-4">
              <img
                src={previewUrls[type]!}
                alt={label}
                className="w-full h-48 object-contain"
              />
              {hasNewImage && (
                <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                  Neu
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageSelect(type, e.target.files[0])}
                />
                <div className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-center transition-colors">
                  Bild ändern
                </div>
              </label>
              <button
                type="button"
                onClick={() => handleImageRemove(type)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Bild entfernen
              </button>
            </div>
          </div>
        ) : (
          <label className="block cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageSelect(type, e.target.files[0])}
            />
            <div className="border-2 border-dashed border-slate-500 rounded-lg p-8 hover:border-blue-500 transition-colors">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <Upload className="w-12 h-12" />
                <div className="text-center">
                  <p className="font-medium">Bild hochladen</p>
                  <p className="text-sm">Klicken oder Bild hierher ziehen</p>
                </div>
              </div>
            </div>
          </label>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            {editingVehicle ? 'Fahrzeug bearbeiten' : 'Fahrzeug hinzufügen'}
          </h2>
          <button
            onClick={resetForm}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {message && (
          <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-medium text-white mb-4">Kennzeichen / Fahrzeugkennung</h3>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Buchstaben
                </label>
                <input
                  type="text"
                  value={formData.plate_letters}
                  onChange={(e) => setFormData({ ...formData, plate_letters: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-center text-2xl font-bold uppercase"
                  placeholder="MI"
                  maxLength={3}
                  required
                />
              </div>
              <div className="flex items-end">
                <div className="text-3xl font-bold text-slate-600 mb-3">|</div>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nummer
                </label>
                <input
                  type="text"
                  value={formData.plate_number}
                  onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-center text-2xl font-bold"
                  placeholder="299"
                  maxLength={5}
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">Barcode-Bilder</h3>

            <ImageUploadSection
              type="vehicle_code"
              label="Fahrzeugcode"
            />

            <ImageUploadSection
              type="cooling_code"
              label=""
              icon={<Snowflake className="w-5 h-5 text-blue-400" />}
            />

            <ImageUploadSection
              type="standard_code"
              label=""
              icon={<Snowflake className="w-5 h-5 text-orange-400" />}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={uploading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Wird hochgeladen...
                </>
              ) : (
                editingVehicle ? 'Aktualisieren' : 'Hinzufügen'
              )}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Fahrzeuge</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Fahrzeug hinzufügen
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Fahrzeug suchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
        />
      </div>

      {filteredVehicles.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Car className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">
            {searchQuery ? 'Keine Fahrzeuge gefunden' : 'Keine Fahrzeuge vorhanden'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((vehicle) => (
            <div key={vehicle.id} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Car className="w-6 h-6 text-blue-400" />
                  <span className="text-xl font-bold text-white">
                    {vehicle.plate_letters} {vehicle.plate_number}
                  </span>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="space-y-2">
                  <div className="text-xs text-slate-400 font-medium">Fahrzeugcode</div>
                  <div className="bg-white rounded p-2">
                    <img
                      src={vehicle.vehicle_code_image_url}
                      alt="Fahrzeugcode"
                      className="w-full h-20 object-contain"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-center">
                    <Snowflake className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="bg-white rounded p-2">
                    <img
                      src={vehicle.cooling_code_image_url}
                      alt="Cooling Code"
                      className="w-full h-20 object-contain"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-center">
                    <Snowflake className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="bg-white rounded p-2">
                    <img
                      src={vehicle.standard_code_image_url}
                      alt="Standard Code"
                      className="w-full h-20 object-contain"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(vehicle)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Bearbeiten
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(vehicle.id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {showDeleteConfirm === vehicle.id && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
                    <div className="flex items-center gap-3 mb-4">
                      <AlertCircle className="w-6 h-6 text-red-400" />
                      <h3 className="text-xl font-bold text-white">Fahrzeug löschen?</h3>
                    </div>
                    <p className="text-slate-300 mb-6">
                      Möchten Sie das Fahrzeug <span className="font-bold">{vehicle.plate_letters} {vehicle.plate_number}</span> wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleDelete(vehicle.id)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Löschen
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
