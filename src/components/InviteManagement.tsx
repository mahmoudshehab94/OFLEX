import { useState, useEffect } from 'react';
import { supabase, generateInviteToken, AccountInvite } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getPermissions } from '../lib/permissions';
import { UserPlus, Copy, Check, Clock, XCircle, X, Share2, AlertCircle, Trash2 } from 'lucide-react';

export function InviteManagement() {
  const { user } = useAuth();
  const permissions = getPermissions(user?.role as 'admin' | 'supervisor' | 'driver' | null);

  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;

  const [invites, setInvites] = useState<AccountInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState('');

  const [selectedRole, setSelectedRole] = useState<'driver' | 'supervisor' | 'admin'>('driver');
  const [username, setUsername] = useState('');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadInvites();
  }, []);

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

    if (selectedRole === 'supervisor' && !permissions.canCreateSupervisors) {
      setMessage({ type: 'error', text: 'Sie haben keine Berechtigung, Supervisor-Einladungen zu erstellen' });
      return;
    }

    if (selectedRole === 'admin' && !permissions.canCreateAdmins) {
      setMessage({ type: 'error', text: 'Sie haben keine Berechtigung, Admin-Einladungen zu erstellen' });
      return;
    }

    if (!username.trim()) {
      setMessage({ type: 'error', text: 'Bitte geben Sie einen Benutzernamen ein' });
      return;
    }

    // Validate username format
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      setMessage({ type: 'error', text: 'Benutzername kann nur Buchstaben, Zahlen, Punkte, Unterstriche und Bindestriche enthalten' });
      return;
    }

    setGenerating(true);
    setMessage(null);

    // Check if username already exists
    if (supabase) {
      const { data: existingUsername } = await supabase
        .from('user_accounts')
        .select('id')
        .eq('username', username.trim())
        .maybeSingle();

      if (existingUsername) {
        setMessage({ type: 'error', text: 'Benutzername ist bereits vergeben' });
        setGenerating(false);
        return;
      }

      // Check if email already exists (username@domain.com format)
      const emailToCheck = `${username.trim().toLowerCase()}@transo-flex.de`;
      const { data: existingEmail } = await supabase
        .from('user_accounts')
        .select('id')
        .eq('email', emailToCheck)
        .maybeSingle();

      if (existingEmail) {
        setMessage({ type: 'error', text: 'E-Mail-Adresse ist bereits vergeben' });
        setGenerating(false);
        return;
      }
    }

    const newDriverData = {
      name: username.trim(),
      license_letters: '',
      license_numbers: '',
      username: username.trim(),
      email_local_part: username.trim().toLowerCase()
    };

    const result = await generateInviteToken(
      selectedRole,
      user.id,
      undefined,
      newDriverData
    );

    if (result.success && result.token) {
      const inviteUrl = `${appUrl}/register?token=${result.token}`;
      setGeneratedInviteUrl(inviteUrl);
      setShowShareModal(true);
      await loadInvites();
      setUsername('');
    } else {
      setMessage({ type: 'error', text: result.error || 'Fehler beim Erstellen der Einladung' });
    }

    setGenerating(false);
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (!supabase) return;
    if (!confirm('Möchten Sie diese Einladung wirklich löschen?')) return;

    setDeleting(inviteId);

    const { error } = await supabase
      .from('account_invites')
      .delete()
      .eq('id', inviteId);

    if (error) {
      setMessage({ type: 'error', text: 'Fehler beim Löschen der Einladung' });
    } else {
      setMessage({ type: 'success', text: 'Einladung erfolgreich gelöscht' });
      await loadInvites();
    }

    setDeleting(null);
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

  const getInviteStatus = (invite: AccountInvite) => {
    if (invite.status === 'used' || invite.is_used) {
      return { status: 'Verwendet', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' };
    }

    if (invite.expires_at) {
      const expiresAt = new Date(invite.expires_at);
      if (expiresAt < new Date()) {
        return { status: 'Abgelaufen', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
      }
    }

    const createdAt = new Date(invite.created_at);
    const now = new Date();
    const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > 30) {
      return { status: 'Abgelaufen', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
    }

    return { status: 'Aktiv', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' };
  };

  const formatCreatedAt = (createdAt: string) => {
    const date = new Date(createdAt);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
                  Einladungslink
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
              </div>

              <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-4">
                Dieser Einladungslink läuft nach 30 Tagen ab
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

        {message && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{message.text}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Rolle
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as 'driver' | 'supervisor' | 'admin')}
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

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Benutzername *
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="z.B. osama.ali"
              className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 text-base"
              required
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Dies wird als Anzeigename und Benutzername verwendet
            </p>
          </div>

          <button
            onClick={handleGenerateInvite}
            disabled={generating || !username.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition font-medium"
          >
            {generating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Generiere...
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Einladung erstellen
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mt-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
          Einladungsverlauf
        </h2>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : invites.length === 0 ? (
          <p className="text-center py-8 text-slate-500 dark:text-slate-400">
            Noch keine Einladungen erstellt
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Rolle</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Benutzername</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Erstellt am</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => {
                  const status = getInviteStatus(invite);
                  const inviteUrl = `${appUrl}/register?token=${invite.token}`;

                  return (
                    <tr key={invite.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          {invite.role === 'driver' ? 'Fahrer' : invite.role === 'supervisor' ? 'Supervisor' : 'Admin'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-900 dark:text-white font-medium">
                        {invite.new_driver_name || invite.username || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                        {formatCreatedAt(invite.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                          {status.status === 'Aktiv' && <Clock className="w-3 h-3 mr-1" />}
                          {status.status === 'Verwendet' && <Check className="w-3 h-3 mr-1" />}
                          {status.status === 'Abgelaufen' && <XCircle className="w-3 h-3 mr-1" />}
                          {status.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {status.status === 'Aktiv' && (
                            <button
                              onClick={() => copyInviteLink(inviteUrl)}
                              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                            >
                              {copiedToken === inviteUrl ? (
                                <>
                                  <Check className="w-4 h-4" />
                                  Kopiert
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4" />
                                  Link
                                </>
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteInvite(invite.id)}
                            disabled={deleting === invite.id}
                            className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
                          >
                            {deleting === invite.id ? (
                              <div className="w-4 h-4 border-2 border-red-600/20 border-t-red-600 rounded-full animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4" />
                                Löschen
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
