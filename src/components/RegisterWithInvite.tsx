import { useState, useEffect, useRef } from 'react';
import { supabase, uploadAvatar, AccountInvite } from '../lib/supabase';
import { UserPlus, Lock, Loader2, Upload, X, AlertCircle, Eye, EyeOff } from 'lucide-react';

export function RegisterWithInvite() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inviteToken, setInviteToken] = useState('');
  const [inviteData, setInviteData] = useState<AccountInvite | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validatingInvite, setValidatingInvite] = useState(true);
  const [inviteValid, setInviteValid] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      setInviteToken(token);
      validateInvite(token);
    } else {
      setValidatingInvite(false);
      setError('Kein Einladungstoken bereitgestellt. Bitte verwenden Sie den Link aus Ihrer Einladung.');
    }
  }, []);

  const validateInvite = async (token: string) => {
    if (!supabase) {
      setError('Datenbankverbindung nicht verfügbar');
      setValidatingInvite(false);
      return;
    }

    setValidatingInvite(true);
    setError('');

    try {
      // Fetch invitation from database (public read access enabled)
      const { data: invite, error: inviteError } = await supabase
        .from('account_invites')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (inviteError) {
        console.error('Invite validation error:', inviteError);
        setInviteValid(false);
        setError('Fehler beim Überprüfen der Einladung');
        setValidatingInvite(false);
        return;
      }

      if (!invite) {
        setInviteValid(false);
        setError('Diese Einladung ist ungültig oder wurde bereits verwendet.');
        setValidatingInvite(false);
        return;
      }

      // Check if already used
      if (invite.status === 'used' || invite.is_used) {
        setInviteValid(false);
        setError('Diese Einladung wurde bereits verwendet.');
        setValidatingInvite(false);
        return;
      }

      // Check expiration (30 days from creation OR expires_at field)
      if (invite.expires_at) {
        const expiresAt = new Date(invite.expires_at);
        if (expiresAt < new Date()) {
          setInviteValid(false);
          setError('Diese Einladung ist abgelaufen. Bitte kontaktieren Sie Ihren Administrator für eine neue Einladung.');
          setValidatingInvite(false);
          return;
        }
      } else {
        const inviteCreatedAt = new Date(invite.created_at);
        const now = new Date();
        const daysDiff = (now.getTime() - inviteCreatedAt.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff > 30) {
          setInviteValid(false);
          setError('Diese Einladung ist abgelaufen. Bitte kontaktieren Sie Ihren Administrator für eine neue Einladung.');
          setValidatingInvite(false);
          return;
        }
      }

      // Invitation is valid
      setInviteValid(true);
      setInviteData(invite);
      setValidatingInvite(false);
    } catch (error) {
      console.error('Unexpected validation error:', error);
      setInviteValid(false);
      setError('Ein unerwarteter Fehler ist aufgetreten');
      setValidatingInvite(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Avatar-Bild muss kleiner als 2 MB sein');
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError('Bitte wählen Sie eine Bilddatei');
        return;
      }

      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!inviteValid || !inviteData) {
      setError('Ungültiger Einladungstoken. Bitte verwenden Sie den korrekten Einladungslink.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }

    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    setLoading(true);

    try {
      let avatarUrl: string | undefined;

      // Upload avatar if provided
      if (avatarFile) {
        const tempUserId = crypto.randomUUID();
        const uploadResult = await uploadAvatar(avatarFile, tempUserId);

        if (uploadResult.success && uploadResult.url) {
          avatarUrl = uploadResult.url;
        } else {
          console.warn('Avatar upload failed, continuing without avatar');
        }
      }

      // Use preset values from invitation
      const username = inviteData.username || inviteData.new_driver_name || '';
      const emailLocalPart = inviteData.email_local_part || username.toLowerCase();

      // Call the Edge Function to handle registration
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/register-with-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          inviteToken,
          emailLocalPart: emailLocalPart.trim(),
          password,
          username: username.trim(),
          avatarUrl
        })
      });

      const result = await response.json();

      if (result.success) {
        // Clear any existing session before redirecting
        localStorage.removeItem('userSession');

        // Registration successful - redirect to login with success message
        alert('Registrierung erfolgreich! Bitte melden Sie sich jetzt mit Ihren neuen Zugangsdaten an.');
        window.location.href = '/';
      } else {
        setError(result.error || 'Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      setError('Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  if (validatingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-md border border-slate-200 dark:border-slate-700">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">Überprüfe Einladung...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!inviteValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-md border border-slate-200 dark:border-slate-700">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Ungültige Einladung</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">{error}</p>
            <a
              href="/"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Zur Startseite
            </a>
          </div>
        </div>
      </div>
    );
  }

  const username = inviteData?.username || inviteData?.new_driver_name || '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4 py-8">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-md border border-slate-200 dark:border-slate-700">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Konto erstellen
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            {username ? (
              <>Willkommen, <span className="font-medium">{username}</span></>
            ) : (
              'Vervollständigen Sie Ihre Registrierung'
            )}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username Display (read-only) */}
          {username && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100 mb-1 font-medium">
                Ihr Benutzername
              </p>
              <p className="text-lg text-blue-900 dark:text-blue-100 font-bold">
                {username}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                E-Mail: {(inviteData?.email_local_part || username).toLowerCase()}@malek.com
              </p>
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Passwort *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindestens 6 Zeichen"
                className="w-full pl-10 pr-12 py-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Passwort bestätigen *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Passwort wiederholen"
                className="w-full pl-10 pr-12 py-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Avatar Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Profilbild (optional)
            </label>
            {avatarPreview ? (
              <div className="flex items-center gap-4">
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="w-20 h-20 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700"
                />
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition"
              >
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Klicken Sie hier, um ein Bild hochzuladen
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                  Maximal 2 MB
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition font-medium text-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Registriere...
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Konto erstellen
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            Bereits registriert? Jetzt anmelden
          </a>
        </div>
      </div>
    </div>
  );
}
