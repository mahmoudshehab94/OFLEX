import { supabase } from './supabase';

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => void>;
    OneSignal?: any;
  }
}

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '';

export interface NotificationSubscription {
  id: string;
  user_account_id: string;
  onesignal_player_id: string | null;
  onesignal_external_id: string | null;
  enabled: boolean;
  role: 'driver' | 'supervisor' | 'admin';
  driver_id: string | null;
  reminder_start_hour?: number;
  reminder_interval_minutes?: number;
  skip_weekends?: boolean;
  created_at: string;
  updated_at: string;
}

export class OneSignalService {
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (this.initialized || !ONESIGNAL_APP_ID) {
      return;
    }

    try {
      window.OneSignalDeferred = window.OneSignalDeferred || [];

      window.OneSignalDeferred.push(async function(OneSignal: any) {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          safari_web_id: undefined,
          notifyButton: {
            enable: false,
          },
          allowLocalhostAsSecureOrigin: true,
        });
      });

      const script = document.createElement('script');
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.defer = true;
      document.head.appendChild(script);

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize OneSignal:', error);
    }
  }

  static async requestPermission(): Promise<boolean> {
    if (!window.OneSignal) {
      await this.waitForOneSignal();
    }

    try {
      const permission = await window.OneSignal.Notifications.permission;
      if (permission === 'granted') {
        return true;
      }

      const result = await window.OneSignal.Notifications.requestPermission();
      return result === true;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }

  static async subscribeUser(
    userAccountId: string,
    role: 'driver' | 'supervisor' | 'admin',
    driverId?: string
  ): Promise<NotificationSubscription | null> {
    if (!window.OneSignal) {
      await this.waitForOneSignal();
    }

    if (!supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        throw new Error('Notification permission denied');
      }

      const externalId = `user_${userAccountId}`;
      await window.OneSignal.login(externalId);

      const playerId = await window.OneSignal.User.PushSubscription.id;

      const { data, error } = await supabase
        .from('notification_subscriptions')
        .upsert({
          user_account_id: userAccountId,
          onesignal_player_id: playerId || null,
          onesignal_external_id: externalId,
          enabled: true,
          role,
          driver_id: driverId || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_account_id'
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Failed to subscribe user to notifications:', error);
      return null;
    }
  }

  static async unsubscribeUser(userAccountId: string): Promise<boolean> {
    if (!window.OneSignal) {
      await this.waitForOneSignal();
    }

    if (!supabase) {
      console.error('Supabase client not initialized');
      return false;
    }

    try {
      await window.OneSignal.logout();

      const { error } = await supabase
        .from('notification_subscriptions')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq('user_account_id', userAccountId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Failed to unsubscribe user from notifications:', error);
      return false;
    }
  }

  static async getSubscription(userAccountId: string): Promise<NotificationSubscription | null> {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('notification_subscriptions')
        .select('*')
        .eq('user_account_id', userAccountId)
        .maybeSingle();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Failed to get notification subscription:', error);
      return null;
    }
  }

  static async isSubscribed(userAccountId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userAccountId);
    return subscription?.enabled || false;
  }

  private static async waitForOneSignal(timeout = 10000): Promise<void> {
    const startTime = Date.now();

    while (!window.OneSignal && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!window.OneSignal) {
      throw new Error('OneSignal failed to load');
    }
  }
}
