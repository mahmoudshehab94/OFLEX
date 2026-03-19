import { supabase } from './supabase';

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => void>;
    OneSignal?: any;
  }
}

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '';

console.log('🔧 OneSignal Configuration Check:');
console.log('  - App ID:', ONESIGNAL_APP_ID ? `${ONESIGNAL_APP_ID.substring(0, 8)}...` : '❌ NOT SET');
console.log('  - Domain:', window.location.hostname);
console.log('  - Protocol:', window.location.protocol);

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
    if (this.initialized) {
      console.log('✅ OneSignal already initialized');
      return;
    }

    if (!ONESIGNAL_APP_ID) {
      console.error('❌ CRITICAL: VITE_ONESIGNAL_APP_ID is not set!');
      console.error('📋 To fix this:');
      console.error('   1. Go to Netlify Dashboard → Site settings → Environment variables');
      console.error('   2. Add: VITE_ONESIGNAL_APP_ID = 1db29131-1f03-4188-8b3b-af2ae9c43717');
      console.error('   3. Redeploy the site');
      return;
    }

    // Check if running on allowed domain
    const currentDomain = window.location.hostname;
    const allowedDomains = ['transoflex.netlify.app', 'localhost', '127.0.0.1'];

    if (!allowedDomains.includes(currentDomain)) {
      console.warn('⚠️ OneSignal: Not running on allowed domain:', currentDomain);
      console.warn('   Allowed domains:', allowedDomains.join(', '));
      return;
    }

    // Skip OneSignal on localhost if not explicitly enabled
    const isLocalhost = currentDomain === 'localhost' || currentDomain === '127.0.0.1';
    if (isLocalhost) {
      console.warn('⚠️ OneSignal: Running on localhost. Notifications may not work unless configured in OneSignal Dashboard.');
      console.warn('💡 To test notifications, deploy to https://transoflex.netlify.app');
    }

    try {
      console.log('🚀 Initializing OneSignal...');

      return new Promise<void>((resolve) => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];

        window.OneSignalDeferred.push(async function(OneSignal: any) {
          try {
            console.log('⚙️ Configuring OneSignal with App ID:', ONESIGNAL_APP_ID.substring(0, 8) + '...');
            await OneSignal.init({
              appId: ONESIGNAL_APP_ID,
              safari_web_id: undefined,
              notifyButton: {
                enable: false,
              },
              allowLocalhostAsSecureOrigin: true,
              serviceWorkerParam: { scope: '/' },
              serviceWorkerPath: '/OneSignalSDKWorker.js',
            });
            console.log('✅ OneSignal initialized successfully');
            resolve();
          } catch (error) {
            console.error('❌ Failed to configure OneSignal:', error);
            resolve();
          }
        });

        setTimeout(() => {
          if (!window.OneSignal) {
            console.warn('⚠️ OneSignal SDK not loaded yet, resolving anyway');
            resolve();
          }
        }, 5000);
      });
    } catch (error) {
      console.error('❌ Failed to initialize OneSignal:', error);
    } finally {
      this.initialized = true;
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

    if (!this.initialized) {
      console.log('🚀 OneSignal not initialized, initializing now...');
      await this.initialize();
    }

    try {
      if (!window.OneSignal) {
        console.log('⏳ Waiting for OneSignal to load...');
        await this.waitForOneSignal();
      }
      console.log('✅ OneSignal is available');
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

  private static async waitForOneSignal(timeout = 20000): Promise<void> {
    const startTime = Date.now();

    console.log('⏳ Waiting for OneSignal to be ready...');

    while (!window.OneSignal && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (!window.OneSignal) {
      console.error('❌ OneSignal not available after', timeout, 'ms');
      console.error('💡 This might be due to:');
      console.error('   1. Ad blockers blocking OneSignal SDK');
      console.error('   2. Network issues preventing SDK download');
      console.error('   3. Browser privacy settings blocking third-party scripts');
      throw new Error('OneSignal failed to load');
    }

    console.log('✅ OneSignal is ready');
  }
}
