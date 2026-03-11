import { useState, useEffect } from 'react';
import { supabase, generateInviteToken, AccountInvite, Driver } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getPermissions } from '../lib/permissions';
import { UserPlus, Copy, Check, Clock, XCircle, Search, Loader2, Link as LinkIcon, User, Mail, X, Share2 } from 'lucide-react';

type InviteType = 'existing' | 'new';

export function InviteManagement() {
  const { user } = useAuth();
  const permissions = getPermissions(user?.role as 'admin' | 'supervisor' | 'driver' | null);

  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;

  console.log('🔗 App URL for invites:', appUrl);

  const [invites, setInvites] = useState<AccountInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState('');

  const [selectedRole, setSelectedRole] = useState<'driver' | 'supervisor' | 'admin'>('driver');
  const [inviteType, setInviteType] = useState<InviteType>('new');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [driverSearch, setDriverSearch] = useState('');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);

  const [newDriverData, setNewDriverData] = useState({
    name: '',
    license_letters: '',
    license_numbers: ''
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadInvites();
    loadDrivers();
  }, []);

  useEffect(() => {
    if (driverSearch.trim() === '') {
      setFilteredDrivers(drivers);
    } else {
      const search = driverSearch.toLowerCase();
      setFilteredDrivers(
        drivers.filter(
          (d) =>
            d.driver_name.toLowerCase().includes(search)
        )
      );
    }
  }, [driverSearch, drivers]);

  const loadDrivers = async () => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('is_active', true)
      .order('driver_name');

    if (!error && data) {
      setDrivers(data);
      setFilteredDrivers(data);
    }
  };

  const loadInvites = async () => {
    if (!supabase) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('account_invites')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setInvites(data);
    }
    setLoading(false);
  };

  const handleGenerateInvite = async () => {
    if (!user) return;

    console.log('🎯 Generating invite with URL:', appUrl);

    if (selectedRole === 'supervisor' && !permissions.canCreateSupervisors) {
      setMessage({ type: 'error', text: 'Sie haben keine Berechtigung, Supervisor-Einladungen zu erstellen' });
      return;
    }

    if (selectedRole === 'admin' && !permissions.canCreateAdmins) {
      setMessage({ type: 'error', text: 'Sie haben keine Berechtigung, Admin-Einladungen zu erstellen' });
      return;
    }

    if (selectedRole === 'driver') {
      if (inviteType === 'existing' && !selectedDriverId) {
        setMessage({ type: 'error', text: 'Bitte wählen Sie einen Fahrer aus' });
        return;
      }

      if (inviteType === 'new') {
        if (!newDriverData.name.trim()) {
          setMessage({ type: 'error', text: 'Fahrername ist erforderlich' });
          return;
        }
      }
    }

    setGenerating(true);
    setMessage(null);

    const result = await generateInviteToken(
      selectedRole,
      user.id,
      selectedRole === 'driver' && inviteType === 'existing' ? selectedDriverId : undefined,
      selectedRole === 'driver' && inviteType === 'new' ? newDriverData : undefined
    );

    if (result.success && result.token) {
      const inviteUrl = `${appUrl}/register?token=${result.token}`;
      setGeneratedInviteUrl(inviteUrl);
      setShowShareModal(true);
      await loadInvites();
      setSelectedDriverId('');
      setDriverSearch('');
      setNewDriverData({ name: '', license_letters: '', license_numbers: '' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Fehler beim Erstellen der Einladung' });
    }

    setGenerating(false);
  };

  const copyInviteLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedToken(url);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const shareViaWhatsApp = (url: string) => {
    const message = encodeURIComponent(`Tritt unserer Plattform bei! Verwende diesen Link, um dein Konto zu erstellen: ${url}`);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const shareViaEmail = (url: string) => {
    const subject = encodeURIComponent('Kontoeinladung');
    const body = encodeURIComponent(`Sie wurden eingeladen, unserer Plattform beizutreten.\n\nBitte verwenden Sie den folgenden Link, um Ihr Konto zu erstellen:\n\n${url}\n\nDieser Link läuft in 1 Stunde ab.`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const getInviteStatus = (invite: AccountInvite) => {
    if (invite.is_used) {
      return { status: 'Verwendet', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' };
    }
    if (new Date(invite.expires_at) < new Date()) {
      return { status: 'Abgelaufen', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
    }
    return { status: 'Aktiv', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' };
  };

  const formatExpiresAt = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) return 'Abgelaufen';
    if (diffMins < 60) return `${diffMins}m verbleibend`;
    return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m verbleibend`;
  };

  return (
    <>
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Share2 className="w-6 h-6 text-blue-600" />
                Einladungslink erstellt
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 font-medium">
                  Invite Link
                </p>
                <p className="text-sm text-slate-900 dark:text-white font-mono break-all">
                  {generatedInviteUrl}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => copyInviteLink(generatedInviteUrl)}
                  className="flex items-center justify-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  {copiedToken === generatedInviteUrl ? (
                    <>
                      <Check className="w-5 h-5" />
                      Kopiert!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Link kopieren
                    </>
                  )}
                </button>

                <button
                  onClick={() => shareViaWhatsApp(generatedInviteUrl)}
                  className="flex items-center justify-center gap-3 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Über WhatsApp teilen
                </button>

                <button
                  onClick={() => shareViaEmail(generatedInviteUrl)}
                  className="flex items-center justify-center gap-3 px-4 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition font-medium"
                >
                  <Mail className="w-5 h-5" />
                  Über E-Mail teilen
                </button>
              </div>

              <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-4">
                Dieser Einladungslink läuft in 1 Stunde ab
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <UserPlus className="w-6 h-6 text-blue-600" />
          Einladung generieren
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Rolle
            </label>
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value as 'driver' | 'supervisor' | 'admin');
                setSelectedDriverId('');
                setNewDriverData({ name: '', license_letters: '', license_numbers: '' });
              }}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="driver">Fahrer</option>
              {permissions.canCreateSupervisors && (
                <option value="supervisor">Supervisor</option>
              )}
              {permissions.canCreateAdmins && (
                <option value="admin">Admin</option>
              )}
            </select>
          </div>

          {selectedRole === 'driver' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Einladungstyp
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setInviteType('new');
                      setSelectedDriverId('');
                    }}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      inviteType === 'new'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <User className={`w-6 h-6 mx-auto mb-2 ${inviteType === 'new' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div className={`font-medium ${inviteType === 'new' ? 'text-blue-900 dark:text-blue-100' : 'text-slate-700 dark:text-slate-300'}`}>
                      Neuer Fahrer
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Konto für neuen Fahrer erstellen
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteType('existing');
                      setNewDriverData({ name: '', license_letters: '', license_numbers: '' });
                    }}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      inviteType === 'existing'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <LinkIcon className={`w-6 h-6 mx-auto mb-2 ${inviteType === 'existing' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div className={`font-medium ${inviteType === 'existing' ? 'text-blue-900 dark:text-blue-100' : 'text-slate-700 dark:text-slate-300'}`}>
                      Bestehender Fahrer
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Mit bestehendem Fahrerdatensatz verknüpfen
                    </div>
                  </button>
                </div>
              </div>

              {inviteType === 'existing' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Fahrer auswählen
                  </label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={driverSearch}
                      onChange={(e) => setDriverSearch(e.target.value)}
                      placeholder="Fahrer suchen..."
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Fahrer auswählen...</option>
                    {filteredDrivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.driver_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {inviteType === 'new' && (
                <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Neuer Fahrer Information
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Fahrername *
                    </label>
                    <input
                      type="text"
                      value={newDriverData.name}
                      onChange={(e) => setNewDriverData({ ...newDriverData, name: e.target.value })}
                      placeholder="Vollständiger Name"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Führerschein-Buchstaben
                      </label>
                      <input
                        type="text"
                        value={newDriverData.license_letters}
                        onChange={(e) => setNewDriverData({ ...newDriverData, license_letters: e.target.value })}
                        placeholder="e.g., ABC"
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Führerschein-Nummern
                      </label>
                      <input
                        type="text"
                        value={newDriverData.license_numbers}
                        onChange={(e) => setNewDriverData({ ...newDriverData, license_numbers: e.target.value })}
                        placeholder="e.g., 123456"
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {message && (
            <div
              className={`p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-900 dark:text-green-200'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            onClick={handleGenerateInvite}
            disabled={generating}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Wird generiert...
              </>
            ) : (
              <>
                <LinkIcon className="w-5 h-5" />
                Einladungslink generieren
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

export function InviteHistory() {
  const [invites, setInvites] = useState<AccountInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const appUrl = import.meta.env.VITE_APP_URL;

  useEffect(() => {
    loadInvites();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadInvites = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('account_invites')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvites(data || []);
    } catch (error) {
      console.error('Error loading invites:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInviteStatus = (invite: AccountInvite) => {
    if (invite.is_used) {
      return { status: 'Verwendet', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' };
    }
    if (new Date(invite.expires_at) < new Date()) {
      return { status: 'Abgelaufen', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
    }
    return { status: 'Aktiv', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' };
  };

  const formatExpiresAt = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) return 'Abgelaufen';
    if (diffMins < 60) return `${diffMins}m verbleibend`;
    return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m verbleibend`;
  };

  const deleteInvite = async (inviteId: string) => {
    if (!confirm('Sind Sie sicher, dass Sie diese Einladung löschen möchten?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('account_invites')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Einladung erfolgreich gelöscht' });
      await loadInvites();
    } catch (error) {
      console.error('Error deleting invite:', error);
      setMessage({ type: 'error', text: 'Fehler beim Löschen der Einladung' });
    }
  };

  const shareViaWhatsApp = (url: string) => {
    const message = encodeURIComponent(`Tritt unserer Plattform bei! Verwende diesen Link, um dein Konto zu erstellen: ${url}`);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const shareViaEmail = (url: string) => {
    const subject = encodeURIComponent('Kontoeinladung');
    const body = encodeURIComponent(`Sie wurden eingeladen, unserer Plattform beizutreten.\n\nBitte verwenden Sie den folgenden Link, um Ihr Konto zu erstellen:\n\n${url}\n\nDieser Link läuft in 1 Stunde ab.`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <>
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Share2 className="w-6 h-6 text-blue-600" />
                Einladung teilen
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 font-medium">
                  Einladungslink:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white overflow-x-auto">
                    {generatedInviteUrl}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedInviteUrl);
                      setMessage({ type: 'success', text: 'Link kopiert!' });
                    }}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition"
                    title="Kopieren"
                  >
                    <Copy className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => shareViaWhatsApp(generatedInviteUrl)}
                  className="flex items-center justify-center gap-3 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium w-full"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Über WhatsApp teilen
                </button>

                <button
                  onClick={() => shareViaEmail(generatedInviteUrl)}
                  className="flex items-center justify-center gap-3 px-4 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition font-medium w-full"
                >
                  <Mail className="w-5 h-5" />
                  Über E-Mail teilen
                </button>
              </div>

              <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-4">
                Dieser Einladungslink läuft in 1 Stunde ab
              </p>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-900 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
          Einladungsverlauf
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : invites.length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-8">
            Noch keine Einladungen erstellt
          </p>
        ) : (
          <div className="space-y-3">
            {invites.map((invite) => {
              const statusInfo = getInviteStatus(invite);
              const isNewDriver = invite.new_driver_name != null;
              const inviteUrl = `${appUrl || ''}/register?token=${invite.token}`;
              return (
                <div
                  key={invite.id}
                  className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white capitalize">
                          {invite.role}
                        </span>
                        {isNewDriver && (
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            Neuer Fahrer
                          </span>
                        )}
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${statusInfo.bg} ${statusInfo.color}`}
                        >
                          {statusInfo.status}
                        </span>
                      </div>
                      {isNewDriver && (
                        <p className="text-sm text-slate-700 dark:text-slate-300 mb-1">
                          {invite.new_driver_name}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mb-1">
                        {invite.token}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatExpiresAt(invite.expires_at)}
                        </span>
                        {invite.used_at && (
                          <span className="flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Verwendet am {new Date(invite.used_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!invite.is_used && new Date(invite.expires_at) > new Date() && (
                        <button
                          onClick={() => {
                            setGeneratedInviteUrl(inviteUrl);
                            setShowShareModal(true);
                          }}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition"
                          title="Einladung teilen"
                        >
                          <Share2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteInvite(invite.id)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                        title="Einladung löschen"
                      >
                        <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
