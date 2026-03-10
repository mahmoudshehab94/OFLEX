import { useState, useEffect } from 'react';
import { supabase, generateInviteToken, AccountInvite, Driver } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getPermissions } from '../lib/permissions';
import { UserPlus, Copy, Check, Clock, XCircle, Search, Loader2, Link as LinkIcon, User } from 'lucide-react';

type InviteType = 'existing' | 'new';

export function InviteManagement() {
  const { user } = useAuth();
  const permissions = getPermissions(user?.role as 'admin' | 'supervisor' | 'driver' | null);

  const [invites, setInvites] = useState<AccountInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const [selectedRole, setSelectedRole] = useState<'driver' | 'supervisor' | 'admin'>('driver');
  const [inviteType, setInviteType] = useState<InviteType>('new');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [driverSearch, setDriverSearch] = useState('');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);

  const [newDriverData, setNewDriverData] = useState({
    code: '',
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
            d.driver_code.toLowerCase().includes(search) ||
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

    if (selectedRole === 'supervisor' && !permissions.canCreateSupervisors) {
      setMessage({ type: 'error', text: 'You do not have permission to create supervisor invites' });
      return;
    }

    if (selectedRole === 'admin' && !permissions.canCreateAdmins) {
      setMessage({ type: 'error', text: 'You do not have permission to create admin invites' });
      return;
    }

    if (selectedRole === 'driver') {
      if (inviteType === 'existing' && !selectedDriverId) {
        setMessage({ type: 'error', text: 'Please select a driver' });
        return;
      }

      if (inviteType === 'new') {
        if (!newDriverData.code.trim()) {
          setMessage({ type: 'error', text: 'Driver code is required' });
          return;
        }
        if (!newDriverData.name.trim()) {
          setMessage({ type: 'error', text: 'Driver name is required' });
          return;
        }

        const existingDriver = drivers.find(d => d.driver_code.toLowerCase() === newDriverData.code.toLowerCase());
        if (existingDriver) {
          setMessage({ type: 'error', text: 'Driver code already exists. Use "Link to Existing Driver" option instead.' });
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
      setMessage({ type: 'success', text: 'Invite created successfully!' });
      await loadInvites();
      setSelectedDriverId('');
      setDriverSearch('');
      setNewDriverData({ code: '', name: '', license_letters: '', license_numbers: '' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to create invite' });
    }

    setGenerating(false);
  };

  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/register?token=${token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getInviteStatus = (invite: AccountInvite) => {
    if (invite.is_used) {
      return { status: 'Used', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' };
    }
    if (new Date(invite.expires_at) < new Date()) {
      return { status: 'Expired', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
    }
    return { status: 'Active', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' };
  };

  const formatExpiresAt = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) return 'Expired';
    if (diffMins < 60) return `${diffMins}m remaining`;
    return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m remaining`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <UserPlus className="w-6 h-6 text-blue-600" />
          Generate Invite
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value as 'driver' | 'supervisor' | 'admin');
                setSelectedDriverId('');
                setNewDriverData({ code: '', name: '', license_letters: '', license_numbers: '' });
              }}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="driver">Driver</option>
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
                  Invite Type
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
                      New Driver
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Create account for new driver
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteType('existing');
                      setNewDriverData({ code: '', name: '', license_letters: '', license_numbers: '' });
                    }}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      inviteType === 'existing'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <LinkIcon className={`w-6 h-6 mx-auto mb-2 ${inviteType === 'existing' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div className={`font-medium ${inviteType === 'existing' ? 'text-blue-900 dark:text-blue-100' : 'text-slate-700 dark:text-slate-300'}`}>
                      Existing Driver
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Link to existing driver record
                    </div>
                  </button>
                </div>
              </div>

              {inviteType === 'existing' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Select Driver
                  </label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={driverSearch}
                      onChange={(e) => setDriverSearch(e.target.value)}
                      placeholder="Search drivers..."
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a driver...</option>
                    {filteredDrivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.driver_code} - {driver.driver_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {inviteType === 'new' && (
                <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    New Driver Information
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Driver Code *
                    </label>
                    <input
                      type="text"
                      value={newDriverData.code}
                      onChange={(e) => setNewDriverData({ ...newDriverData, code: e.target.value })}
                      placeholder="e.g., D001"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Driver Name *
                    </label>
                    <input
                      type="text"
                      value={newDriverData.name}
                      onChange={(e) => setNewDriverData({ ...newDriverData, name: e.target.value })}
                      placeholder="Full name"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        License Letters
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
                        License Numbers
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
                Generating...
              </>
            ) : (
              <>
                <LinkIcon className="w-5 h-5" />
                Generate Invite Link
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
          Invite History
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : invites.length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-8">
            No invites created yet
          </p>
        ) : (
          <div className="space-y-3">
            {invites.map((invite) => {
              const statusInfo = getInviteStatus(invite);
              const isNewDriver = invite.new_driver_code != null;
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
                            New Driver
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
                          {invite.new_driver_code} - {invite.new_driver_name}
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
                            Used {new Date(invite.used_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      {!invite.is_used && new Date(invite.expires_at) > new Date() && (
                        <button
                          onClick={() => copyInviteLink(invite.token)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition"
                          title="Copy invite link"
                        >
                          {copiedToken === invite.token ? (
                            <Check className="w-5 h-5 text-green-600" />
                          ) : (
                            <Copy className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
