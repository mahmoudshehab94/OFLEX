import { useState, useEffect } from 'react';
import { Bell, BellOff, Check, AlertCircle } from 'lucide-react';
import { OneSignalService } from '../lib/onesignal';

interface NotificationSettingsProps {
  userAccountId: string;
  role: 'driver' | 'supervisor' | 'admin';
  driverId?: string;
}

export function NotificationSettings({ userAccountId, role, driverId }: NotificationSettingsProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    checkSubscriptionStatus();
    OneSignalService.initialize();
  }, [userAccountId]);

  const checkSubscriptionStatus = async () => {
    try {
      const subscribed = await OneSignalService.isSubscribed(userAccountId);
      setIsSubscribed(subscribed);
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
      const subscription = await OneSignalService.subscribeUser(userAccountId, role, driverId);

      if (subscription) {
        setIsSubscribed(true);
        setMessage({
          type: 'success',
          text: 'تم تفعيل الإشعارات بنجاح! ستتلقى تذكيرات يومية بعد الساعة 6 مساءً.'
        });
      } else {
        throw new Error('Failed to subscribe');
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error);
      setMessage({
        type: 'error',
        text: 'فشل تفعيل الإشعارات. يرجى التأكد من السماح بالإشعارات في المتصفح.'
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
          text: 'تم إيقاف الإشعارات بنجاح.'
        });
      } else {
        throw new Error('Failed to unsubscribe');
      }
    } catch (error) {
      console.error('Failed to disable notifications:', error);
      setMessage({
        type: 'error',
        text: 'فشل إيقاف الإشعارات. يرجى المحاولة مرة أخرى.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              إشعارات التذكير
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {role === 'driver'
                ? 'احصل على تذكيرات يومية لتسجيل ساعات العمل بعد الساعة 6 مساءً'
                : 'احصل على ملخص يومي للسائقين الذين لم يسجلوا ساعات العمل'}
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
              <span>إيقاف الإشعارات</span>
            </>
          ) : (
            <>
              <Bell className="h-5 w-5" />
              <span>تفعيل الإشعارات</span>
            </>
          )}
        </button>
      </div>

      {message && (
        <div
          className={`flex items-start gap-2 p-4 rounded-lg ${
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
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-400">
            <strong>ملاحظة:</strong> سيتم إرسال التذكيرات كل 30 دقيقة بدءاً من الساعة 6 مساءً
            حتى تقوم بتسجيل ساعات العمل لليوم الحالي.
          </p>
        </div>
      )}
    </div>
  );
}
