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
  private static initPromise: Promise<void> | null = null;

  private static async cleanupOldServiceWorkers(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log(`🧹 Found ${registrations.length} service worker(s)`);

      for (const registration of registrations) {
        const scriptURL = registration.active?.scriptURL || '';
        console.log('   - Service Worker:', scriptURL);

        if (!scriptURL.includes('OneSignalSDK') && !scriptURL.includes('workbox')) {
          console.log('   ⚠️ Unregistering non-OneSignal service worker');
          await registration.unregister();
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup service workers:', error);
    }
  }

  static async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('✅ OneSignal already initialized');
      return;
    }

    if (this.initPromise) {
      console.log('⏳ OneSignal initialization in progress, waiting...');
      return this.initPromise;
    }

    if (!ONESIGNAL_APP_ID) {
      console.error('❌ CRITICAL: VITE_ONESIGNAL_APP_ID is not set!');
      console.error('📋 To fix this:');
      console.error('   1. Go to Netlify Dashboard → Site settings → Environment variables');
      console.error('   2. Add: VITE_ONESIGNAL_APP_ID = 1db29131-1f03-4188-8b3b-af2ae9c43717');
      console.error('   3. Redeploy the site');
      this.initialized = true;
      return;
    }

    const currentDomain = window.location.hostname;
    const allowedDomains = ['transoflex.netlify.app', 'localhost', '127.0.0.1'];

    if (!allowedDomains.includes(currentDomain)) {
      console.warn('⚠️ OneSignal: Not running on allowed domain:', currentDomain);
      console.warn('   Allowed domains:', allowedDomains.join(', '));
      this.initialized = true;
      return;
    }

    const isLocalhost = currentDomain === 'localhost' || currentDomain === '127.0.0.1';
    if (isLocalhost) {
      console.warn('⚠️ OneSignal: Running on localhost. Notifications may not work unless configured in OneSignal Dashboard.');
      console.warn('💡 To test notifications, deploy to https://transoflex.netlify.app');
    }

    await this.cleanupOldServiceWorkers();

    this.initPromise = new Promise<void>((resolve, reject) => {
      console.log('🚀 Initializing OneSignal...');

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
            serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js',
          });

          console.log('✅ OneSignal.init() completed');

          await new Promise(resolve => setTimeout(resolve, 1000));

          console.log('✅ OneSignal fully initialized and ready');
          resolve();
        } catch (error) {
          console.error('❌ Failed to configure OneSignal:', error);
          reject(error);
        }
      });

      setTimeout(() => {
        if (!window.OneSignal) {
          console.warn('⚠️ OneSignal SDK not loaded after 10 seconds');
          reject(new Error('OneSignal SDK timeout'));
        }
      }, 10000);
    });

    try {
      await this.initPromise;
      this.initialized = true;
      console.log('✅ OneSignal initialization complete');
    } catch (error) {
      console.error('❌ Failed to initialize OneSignal:', error);
      this.initialized = true;
      throw error;
    } finally {
      this.initPromise = null;
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

    await this.waitForOneSignal();

    if (!supabase) {
      console.error('❌ Supabase client not initialized');
      throw new Error('Database not available');
    }

    try {
      console.log('📱 Requesting notification permission...');
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.error('❌ Notification permission denied');
        throw new Error('Bitte erlauben Sie Benachrichtigungen im Browser');
      }

      console.log('✅ Permission granted');

      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('🔑 Logging in to OneSignal...');
      const externalId = `user_${userAccountId}`;
      await window.OneSignal.login(externalId);

      await new Promise(resolve => setTimeout(resolve, 1000));

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
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!window.OneSignal) {
      console.error('❌ OneSignal not available after', timeout, 'ms');
      console.error('💡 This might be due to:');
      console.error('   1. Ad blockers blocking OneSignal SDK');
      console.error('   2. Network issues preventing SDK download');
      console.error('   3. Browser privacy settings blocking third-party scripts');
      throw new Error('OneSignal failed to load');
    }

    console.log('✅ OneSignal object is available');

    if ('serviceWorker' in navigator) {
      const maxWaitTime = 5000;
      const checkStartTime = Date.now();

      while (Date.now() - checkStartTime < maxWaitTime) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const oneSignalSW = registrations.find(reg =>
          reg.active?.scriptURL.includes('OneSignalSDK')
        );

        if (oneSignalSW && oneSignalSW.active?.state === 'activated') {
          console.log('✅ OneSignal Service Worker is active and ready');
          await new Promise(resolve => setTimeout(resolve, 500));
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.warn('⚠️ Service Worker not fully ready, proceeding anyway');
    }

    console.log('✅ OneSignal is ready');
  }
}
