import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { validateInviteToken, uploadAvatar, AccountInvite } from '../lib/supabase';
import { UserPlus, Lock, Mail, User, Loader2, Upload, X, AlertCircle } from 'lucide-react';

const COMPANY_DOMAIN = '@malek.com';

export function RegisterWithInvite() {
  const { register } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inviteToken, setInviteToken] = useState('');
  const [inviteData, setInviteData] = useState<AccountInvite | null>(null);
  const [emailLocalPart, setEmailLocalPart] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
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
      setError('Kein Einladungstoken bereitgestellt. Bitte verwenden Sie den Link aus Ihrer Einladungs-E-Mail.');
    }
  }, []);

  const validateInvite = async (token: string) => {
    setValidatingInvite(true);
    setError('');

    const result = await validateInviteToken(token);

    if (result.valid && result.invite) {
      setInviteValid(true);
      setInviteData(result.invite);

      // Pre-fill username from invite if available
      if (result.invite.username) {
        setUsername(result.invite.username);
      }

      // Pre-fill email local part from invite if available
      if (result.invite.email_local_part) {
        setEmailLocalPart(result.invite.email_local_part);
      }
    } else {
      setInviteValid(false);

      // Provide specific German error messages
      let errorMessage = 'Ungültige Einladung';
      if (result.error) {
        if (result.error.includes('already been used')) {
          errorMessage = 'Diese Einladung wurde bereits verwendet.';
        } else if (result.error.includes('expired')) {
          errorMessage = 'Diese Einladung ist abgelaufen. Bitte kontaktieren Sie Ihren Administrator für eine neue Einladung.';
        } else if (result.error.includes('Invalid invite token')) {
          errorMessage = 'Einladungstoken ist ungültig. Bitte überprüfen Sie den Link.';
        }
      }
      setError(errorMessage);
    }
    setValidatingInvite(false);
  };

  const validateEmailLocalPart = (value: string): boolean => {
    // Check if user tried to enter full email with @
    if (value.includes('@')) {
      setEmailError('Bitte geben Sie nur den Teil vor @malek.com ein. Geben Sie keine vollständige E-Mail-Adresse ein.');
      return false;
    }

    // Basic validation for local part
    if (value && !/^[a-zA-Z0-9._-]+$/.test(value)) {
      setEmailError('Nur Buchstaben, Zahlen, Punkte, Unterstriche und Bindestriche sind erlaubt.');
      return false;
    }

    setEmailError('');
    return true;
  };

  const handleEmailLocalPartChange = (value: string) => {
    setEmailLocalPart(value);
    validateEmailLocalPart(value);
    setError('');
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
    setEmailError('');

    if (!inviteValid || !inviteData) {
      setError('Ungültiger Einladungstoken. Bitte verwenden Sie den korrekten Einladungslink.');
      return;
    }

    // Validate email local part
    if (!validateEmailLocalPart(emailLocalPart)) {
      return;
    }

    if (!emailLocalPart.trim()) {
      setEmailError('Bitte geben Sie den E-Mail-Teil vor @malek.com ein.');
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

    if (!username.trim()) {
      setError('Benutzername ist erforderlich.');
      return;
    }

    setLoading(true);

    try {
      let avatarUrl: string | undefined;

      if (avatarFile) {
        const tempUserId = crypto.randomUUID();
        const uploadResult = await uploadAvatar(avatarFile, tempUserId);

        if (uploadResult.success && uploadResult.url) {
          avatarUrl = uploadResult.url;
        } else {
          setError('Avatar-Upload fehlgeschlagen. Fahre ohne Avatar fort.');
        }
      }

      // Construct full email with fixed domain
      const fullEmail = `${emailLocalPart.trim()}${COMPANY_DOMAIN}`;

      const result = await register(fullEmail, password, username, inviteToken, avatarUrl);

      if (result.success) {
        window.location.href = '/';
      } else {
        // Provide better error messages
        let errorMessage = result.error || 'Registrierung fehlgeschlagen';

        if (result.error?.includes('already registered') || result.error?.includes('already exists')) {
          errorMessage = 'Dieses Konto existiert bereits. Bitte verwenden Sie einen anderen Benutzernamen oder E-Mail.';
        } else if (result.error?.includes('Invalid invite')) {
          errorMessage = 'Einladung ist ungültig oder abgelaufen.';
        } else if (result.error?.includes('Failed to create')) {
          errorMessage = 'Die Registrierung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut oder kontaktieren Sie Ihren Administrator.';
        }

        setError(errorMessage);
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  if (validatingInvite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-8 border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <p className="text-slate-600 dark:text-slate-300">Einladung wird validiert...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!inviteValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-8 border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col items-center gap-4">
            <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded-full">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-white">
              Ungültige Einladung
            </h1>
            <p className="text-center text-slate-600 dark:text-slate-300">
              {error}
            </p>
            <p className="text-sm text-center text-slate-500 dark:text-slate-400 mt-2">
              Bitte kontaktieren Sie Ihren Administrator für eine neue Einladung.
            </p>
            <a
              href="/"
              className="mt-4 text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Zur Anmeldung
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-8 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-blue-600 p-3 rounded-full">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2">
          Erstellen Sie Ihr Konto
        </h1>
        <p className="text-center text-slate-600 dark:text-slate-300 mb-2">
          Sie wurden als <span className="font-semibold capitalize">{inviteData?.role}</span> eingeladen
        </p>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-8">
          Vervollständigen Sie Ihre Registrierung
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="emailLocal" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              E-Mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <div className="flex items-center">
                <input
                  type="text"
                  id="emailLocal"
                  value={emailLocalPart}
                  onChange={(e) => handleEmailLocalPartChange(e.target.value)}
                  placeholder="benutzername"
                  className={`w-full pl-10 pr-2 py-3 border ${emailError ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition`}
                  required
                  disabled={loading}
                  autoComplete="off"
                />
                <div className="px-3 py-3 bg-slate-100 dark:bg-slate-600 border border-l-0 border-slate-300 dark:border-slate-600 rounded-r-lg text-slate-600 dark:text-slate-300 font-medium">
                  {COMPANY_DOMAIN}
                </div>
              </div>
            </div>
            {emailError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-start gap-1">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{emailError}</span>
              </p>
            )}
            {!emailError && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Nur den Teil vor @malek.com eingeben.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              Benutzername
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition cursor-not-allowed"
                required
                disabled={true}
                readOnly={!!inviteData?.username}
              />
            </div>
            {inviteData?.username && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Dieser Benutzername wurde vom Administrator vorgegeben.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              Avatar hochladen (Optional)
            </label>
            <div className="flex items-center gap-4">
              {avatarPreview ? (
                <div className="relative">
                  <img
                    src={avatarPreview}
                    alt="Avatar preview"
                    className="w-20 h-20 rounded-full object-cover border-2 border-slate-300 dark:border-slate-600"
                  />
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                    disabled={loading}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600">
                  <User className="w-8 h-8 text-slate-400" />
                </div>
              )}
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="avatar"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-2 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  Bild auswählen
                </button>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Max. 2 MB. JPG, PNG, GIF oder WebP
                </p>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              Passwort
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                required
                disabled={loading}
                minLength={6}
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              Passwort bestätigen
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                required
                disabled={loading}
                minLength={6}
              />
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-900 dark:text-red-200">{error}</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !!emailError}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Registrierung läuft...
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Registrieren
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
          >
            Haben Sie bereits ein Konto? Anmelden
          </a>
        </div>
      </div>
    </div>
  );
}
