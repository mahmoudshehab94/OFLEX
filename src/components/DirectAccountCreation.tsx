import { useState, useEffect } from 'react';
import { supabase, createAccountDirect, Fahrer } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getPermissions } from '../lib/permissions';
import { UserPlus, Eye, EyeOff, Check, AlertCircle, Search, User, Link as LinkIcon, Loader2 } from 'lucide-react';

type AccountType = 'existing' | 'new';

export function DirectAccountCreation() {
  const { user } = useAuth();
  const permissions = getPermissions(user?.role as 'admin' | 'supervisor' | 'driver' | null);

  const [loading, setLoading] = useState(false);
  const [showPasswort, setShowPasswort] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    emailLocalPart: '',
    password: '',
    role: 'driver' as 'driver' | 'supervisor',
  });

  const [accountType, setAccountType] = useState<AccountType>('new');
  const [selectedFahrerId, setSelectedFahrerId] = useState<string>('');
  const [driverSearch, setFahrerSearch] = useState('');
  const [drivers, setFahrers] = useState<Fahrer[]>([]);
  const [filteredFahrers, setFilteredFahrers] = useState<Fahrer[]>([]);


  useEffect(() => {
    loadFahrers();
  }, []);

  useEffect(() => {
    if (driverSearch.trim() === '') {
      setFilteredFahrers(drivers.filter(d => !d.account_id));
    } else {
      const search = driverSearch.toLowerCase();
      setFilteredFahrers(
        drivers
          .filter(d => !d.account_id)
          .filter(
            (d) =>
              d.driver_code.toLowerCase().includes(search) ||
              d.driver_name.toLowerCase().includes(search)
          )
      );
    }
  }, [driverSearch, drivers]);

  const loadFahrers = async () => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from('drivers')
      .select(`
        *,
        user_accounts!fk_driver(id, email, username)
      `)
      .eq('is_active', true)
      .order('driver_name');

    if (!error && data) {
      const driversWithAccountInfo = data.map((driver: any) => {
        const account = Array.isArray(driver.user_accounts) && driver.user_accounts.length > 0
          ? driver.user_accounts[0]
          : driver.user_accounts;

        return {
          ...driver,
          account_id: account?.id || null,
          account_email: account?.email || null,
          account_username: account?.username || null,
          user_accounts: undefined
        };
      });
      setFahrers(driversWithAccountInfo);
      setFilteredFahrers(driversWithAccountInfo.filter(d => !d.account_id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setMessage(null);

    if (formData.role === 'supervisor' && !permissions.canCreateSupervisors) {
      setMessage({ type: 'error', text: 'You do not have permission to create supervisor accounts' });
      setLoading(false);
      return;
    }

    if (!formData.fullName.trim()) {
      setMessage({ type: 'error', text: 'Full name is required' });
      setLoading(false);
      return;
    }

    if (!formData.username.trim()) {
      setMessage({ type: 'error', text: 'Benutzername is required' });
      setLoading(false);
      return;
    }

    if (!formData.emailLocalPart.trim()) {
      setMessage({ type: 'error', text: 'Email is required' });
      setLoading(false);
      return;
    }

    if (!formData.password.trim()) {
      setMessage({ type: 'error', text: 'Passwort is required' });
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setMessage({ type: 'error', text: 'Passwort must be at least 6 characters' });
      setLoading(false);
      return;
    }

    if (formData.role === 'driver' && accountType === 'existing' && !selectedFahrerId) {
      setMessage({ type: 'error', text: 'Please select a driver' });
      setLoading(false);
      return;
    }

    const result = await createAccountDirect(
      {
        fullName: formData.fullName,
        username: formData.username,
        emailLocalPart: formData.emailLocalPart,
        password: formData.password,
        role: formData.role,
        driverId: formData.role === 'driver' && accountType === 'existing' ? selectedFahrerId : undefined,
        newFahrerData: formData.role === 'driver' && accountType === 'new' ? { code: formData.username } : undefined,
      },
      user.id
    );

    if (result.success) {
      setMessage({
        type: 'success',
        text: `Account created successfully for ${formData.fullName}`
      });
      setFormData({
        fullName: '',
        username: '',
        emailLocalPart: '',
        password: '',
        role: 'driver',
      });
      setSelectedFahrerId('');
      setFahrerSearch('');
      setAccountType('new');
      await loadFahrers();
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to create account' });
    }

    setLoading(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <UserPlus className="w-6 h-6 text-blue-600" />
        Konto direkt erstellen
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Rolle
          </label>
          <select
            value={formData.role}
            onChange={(e) => {
              setFormData({ ...formData, role: e.target.value as 'driver' | 'supervisor' });
              setSelectedFahrerId('');
              setNewFahrerData({ code: '', name: '', license_letters: '', license_numbers: '' });
            }}
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="driver">Fahrer</option>
            {permissions.canCreateSupervisors && (
              <option value="supervisor">Supervisor</option>
            )}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Vollständiger Name
          </label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            placeholder="Vollständigen Namen eingeben"
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Benutzername
          </label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            placeholder="Benutzernamen eingeben"
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Email
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={formData.emailLocalPart}
              onChange={(e) => setFormData({ ...formData, emailLocalPart: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })}
              placeholder="username"
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <span className="text-slate-600 dark:text-slate-400 font-medium">@malek.com</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Only English letters and numbers allowed
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Passwort
          </label>
          <div className="relative">
            <input
              type={showPasswort ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Enter password"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="button"
              onClick={() => setShowPasswort(!showPasswort)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            >
              {showPasswort ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Minimum 6 characters
          </p>
        </div>

        {formData.role === 'driver' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Fahrer Account Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAccountType('new');
                    setSelectedFahrerId('');
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    accountType === 'new'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <User className={`w-6 h-6 mx-auto mb-2 ${accountType === 'new' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div className={`font-medium ${accountType === 'new' ? 'text-blue-900 dark:text-blue-100' : 'text-slate-700 dark:text-slate-300'}`}>
                    New Fahrer
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Create new driver record
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAccountType('existing');
                    setNewFahrerData({ code: '', name: '', license_letters: '', license_numbers: '' });
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    accountType === 'existing'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <LinkIcon className={`w-6 h-6 mx-auto mb-2 ${accountType === 'existing' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div className={`font-medium ${accountType === 'existing' ? 'text-blue-900 dark:text-blue-100' : 'text-slate-700 dark:text-slate-300'}`}>
                    Existing Fahrer
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Link to existing driver
                  </div>
                </button>
              </div>
            </div>

            {accountType === 'existing' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Select Fahrer (without account)
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={driverSearch}
                    onChange={(e) => setFahrerSearch(e.target.value)}
                    placeholder="Search drivers..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={selectedFahrerId}
                  onChange={(e) => setSelectedFahrerId(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a driver...</option>
                  {filteredFahrers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.driver_code} - {driver.driver_name}
                    </option>
                  ))}
                </select>
                {filteredFahrers.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    No drivers without accounts found
                  </p>
                )}
              </div>
            )}

          </>
        )}

        {message && (
          <div
            className={`p-4 rounded-lg flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-900 dark:text-green-200'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating Account...
            </>
          ) : (
            <>
              <UserPlus className="w-5 h-5" />
              Konto erstellen
            </>
          )}
        </button>
      </form>
    </div>
  );
}
