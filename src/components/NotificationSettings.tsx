import { useState, useEffect } from 'react';
import { Bell, BellOff, Check, AlertCircle, Settings } from 'lucide-react';
import { OneSignalService } from '../lib/onesignal';
import { supabase } from '../lib/supabase';

interface NotificationSettingsProps {
  userAccountId: string;
  role: 'driver' | 'supervisor' | 'admin';
  driverId?: string;
}

interface NotificationPreferences {
  reminder_start_hour: number;
  reminder_interval_minutes: number;
  skip_weekends: boolean;
}

export function NotificationSettings({ userAccountId, role, driverId }: NotificationSettingsProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    reminder_start_hour: 18,
    reminder_interval_minutes: 30,
    skip_weekends: true,
  });
  const [savingPreferences, setSavingPreferences] = useState(false);

  useEffect(() => {
    checkSubscriptionStatus();
  }, [userAccountId]);

  const checkSubscriptionStatus = async () => {
    try {
      const subscription = await OneSignalService.getSubscription(userAccountId);
      if (subscription) {
        setIsSubscribed(subscription.enabled);
        setPreferences({
          reminder_start_hour: subscription.reminder_start_hour || 18,
          reminder_interval_minutes: subscription.reminder_interval_minutes || 30,
          skip_weekends: subscription.skip_weekends !== false,
        });
      }
    } catch (error) {
      console.error('Failed to check subscription status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      console.log('🎯 Enabling notifications for user:', userAccountId);

      const subscription = await OneSignalService.subscribeUser(userAccountId, role, driverId);

      if (subscription) {
        setIsSubscribed(true);
        setPreferences({
          reminder_start_hour: subscription.reminder_start_hour || 18,
          reminder_interval_minutes: subscription.reminder_interval_minutes || 30,
          skip_weekends: subscription.skip_weekends !== false,
        });
        setMessage({
          type: 'success',
          text: 'Benachrichtigungen erfolgreich aktiviert! Sie erhalten täglich Erinnerungen nach der festgelegten Uhrzeit.'
        });
      } else {
        throw new Error('Speichern fehlgeschlagen');
      }
    } catch (error: any) {
      console.error('❌ Failed to enable notifications:', error);

      let errorMessage = 'Aktivierung der Benachrichtigungen fehlgeschlagen. ';

      if (error?.message?.includes('يرجى السماح') || error?.message?.includes('permission')) {
        errorMessage = error.message;
      } else if (error?.message?.includes('not configured')) {
        errorMessage = 'Benachrichtigungssystem nicht konfiguriert. Bitte kontaktieren Sie die Verwaltung zur Aktivierung von OneSignal.';
      } else if (error?.message?.includes('failed to load')) {
        errorMessage = 'Laden des Benachrichtigungssystems fehlgeschlagen. Bitte überprüfen Sie:\n• Deaktivieren Sie Ad-Blocker\n• Erlauben Sie Skripte von onesignal.com\n• Laden Sie die Seite neu und versuchen Sie es erneut';
      } else if (error?.message?.includes('Database')) {
        errorMessage = 'Datenbankfehler. Bitte versuchen Sie es erneut.';
      } else {
        errorMessage = 'Unerwarteter Fehler aufgetreten. Stellen Sie sicher, dass Sie Benachrichtigungen erlauben und versuchen Sie es erneut.';
      }

      setMessage({
        type: 'error',
        text: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const success = await OneSignalService.unsubscribeUser(userAccountId);

      if (success) {
        setIsSubscribed(false);
        setMessage({
          type: 'success',
          text: 'Benachrichtigungen erfolgreich deaktiviert.'
        });
      } else {
        throw new Error('Failed to unsubscribe');
      }
    } catch (error) {
      console.error('Failed to disable notifications:', error);
      setMessage({
        type: 'error',
        text: 'Deaktivierung der Benachrichtigungen fehlgeschlagen. Bitte versuchen Sie es erneut.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!supabase) {
      setMessage({ type: 'error', text: 'Datenbankverbindungsfehler' });
      return;
    }

    setSavingPreferences(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('notification_subscriptions')
        .update({
          reminder_start_hour: preferences.reminder_start_hour,
          reminder_interval_minutes: preferences.reminder_interval_minutes,
          skip_weekends: preferences.skip_weekends,
          updated_at: new Date().toISOString(),
        })
        .eq('user_account_id', userAccountId);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Einstellungen erfolgreich gespeichert!'
      });
    } catch (error) {
      console.error('Failed to save preferences:', error);
      setMessage({
        type: 'error',
        text: 'Speichern der Einstellungen fehlgeschlagen. Bitte versuchen Sie es erneut.'
      });
    } finally {
      setSavingPreferences(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Erinnerungsbenachrichtigungen
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {role === 'driver'
                ? 'Erhalten Sie tägliche Erinnerungen zur Erfassung Ihrer Arbeitszeiten'
                : 'Erhalten Sie eine tägliche Zusammenfassung der Fahrer, die noch keine Arbeitszeiten erfasst haben'}
            </p>
          </div>
        </div>

        <button
          onClick={isSubscribed ? handleDisableNotifications : handleEnableNotifications}
          disabled={isLoading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            isSubscribed
              ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
              : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLoading ? (
            <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isSubscribed ? (
            <>
              <BellOff className="h-5 w-5" />
              <span>Deaktivieren</span>
            </>
          ) : (
            <>
              <Bell className="h-5 w-5" />
              <span>Aktivieren</span>
            </>
          )}
        </button>
      </div>

      {message && (
        <div
          className={`flex items-start gap-2 p-4 rounded-lg mb-4 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="h-5 w-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          )}
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {isSubscribed && (
        <>
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-400">
              <strong>Hinweis:</strong> Erinnerungen werden ab der festgelegten Uhrzeit gesendet,
              bis Sie Ihre Arbeitszeiten für den aktuellen Tag erfasst haben.
              {preferences.skip_weekends && ' An Samstagen und Sonntagen werden keine Erinnerungen gesendet.'}
            </p>
          </div>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4"
          >
            <Settings className="h-4 w-4" />
            <span>{showAdvanced ? 'Erweiterte Einstellungen ausblenden' : 'Erweiterte Einstellungen'}</span>
          </button>

          {showAdvanced && (
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Startzeit für Erinnerungen (18:00 = 6 Uhr abends)
                </label>
                <select
                  value={preferences.reminder_start_hour}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    reminder_start_hour: parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                >
                  {Array.from({ length: 9 }, (_, i) => i + 16).map(hour => (
                    <option key={hour} value={hour}>
                      {hour}:00 Uhr ({hour > 12 ? `${hour - 12} Uhr abends` : `${hour} Uhr morgens`})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Intervall zwischen Erinnerungen (in Minuten)
                </label>
                <select
                  value={preferences.reminder_interval_minutes}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    reminder_interval_minutes: parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                >
                  <option value={15}>15 Minuten</option>
                  <option value={30}>30 Minuten</option>
                  <option value={45}>45 Minuten</option>
                  <option value={60}>1 Stunde</option>
                  <option value={90}>1,5 Stunden</option>
                  <option value={120}>2 Stunden</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Benachrichtigungen am Wochenende deaktivieren
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Keine Erinnerungen an Samstagen und Sonntagen
                  </p>
                </div>
                <button
                  onClick={() => setPreferences({
                    ...preferences,
                    skip_weekends: !preferences.skip_weekends
                  })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.skip_weekends
                      ? 'bg-blue-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.skip_weekends ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <button
                onClick={handleSavePreferences}
                disabled={savingPreferences}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingPreferences ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Wird gespeichert...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Einstellungen speichern</span>
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
