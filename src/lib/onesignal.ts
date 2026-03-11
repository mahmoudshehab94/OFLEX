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

    // Check if running on allowed domain
    const currentDomain = window.location.hostname;
    const allowedDomains = ['transoflex.netlify.app', 'localhost', '127.0.0.1'];

    if (!allowedDomains.includes(currentDomain)) {
      console.warn('OneSignal: Not running on allowed domain. Skipping initialization.');
      return;
    }

    // Skip OneSignal on localhost if not explicitly enabled
    const isLocalhost = currentDomain === 'localhost' || currentDomain === '127.0.0.1';
    if (isLocalhost) {
      console.warn('⚠️ OneSignal: Running on localhost. Notifications may not work unless configured in OneSignal Dashboard.');
      console.warn('💡 To test notifications, deploy to https://transoflex.netlify.app');
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
    console.log('🔔 Starting subscription process...', { userAccountId, role, driverId });

    if (!ONESIGNAL_APP_ID) {
      console.error('❌ OneSignal App ID not configured');
      throw new Error('OneSignal not configured');
    }

    try {
      if (!window.OneSignal) {
        console.log('⏳ Waiting for OneSignal to load...');
        await this.waitForOneSignal();
      }
    } catch (error) {
      console.error('❌ OneSignal failed to load:', error);
      throw new Error('OneSignal failed to load');
    }

    if (!supabase) {
      console.error('❌ Supabase client not initialized');
      throw new Error('Database not available');
    }

    try {
      console.log('📱 Requesting notification permission...');
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.error('❌ Notification permission denied');
        throw new Error('يرجى السماح بالإشعارات في المتصفح');
      }

      console.log('✅ Permission granted, logging in to OneSignal...');
      const externalId = `user_${userAccountId}`;
      await window.OneSignal.login(externalId);

      console.log('🔑 Getting player ID...');
      const playerId = await window.OneSignal.User.PushSubscription.id;
      console.log('✅ Player ID:', playerId);

      console.log('💾 Saving to database...');
      const { data: existingData } = await supabase
        .from('notification_subscriptions')
        .select('*')
        .eq('user_account_id', userAccountId)
        .maybeSingle();

      let data, error;

      if (existingData) {
        console.log('🔄 Updating existing subscription...');
        const result = await supabase
          .from('notification_subscriptions')
          .update({
            onesignal_player_id: playerId || null,
            onesignal_external_id: externalId,
            enabled: true,
            role,
            driver_id: driverId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_account_id', userAccountId)
          .select()
          .single();

        data = result.data;
        error = result.error;
      } else {
        console.log('➕ Creating new subscription...');
        const result = await supabase
          .from('notification_subscriptions')
          .insert({
            user_account_id: userAccountId,
            onesignal_player_id: playerId || null,
            onesignal_external_id: externalId,
            enabled: true,
            role,
            driver_id: driverId || null,
            reminder_start_hour: 18,
            reminder_interval_minutes: 30,
            skip_weekends: true,
          })
          .select()
          .single();

        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log('✅ Subscription saved successfully!', data);
      return data;
    } catch (error: any) {
      console.error('Failed to subscribe user to notifications:', error);
      throw error;
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
