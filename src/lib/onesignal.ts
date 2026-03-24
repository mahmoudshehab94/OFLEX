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
  private static shouldEnable = false;

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
      console.warn('⚠️ OneSignal App ID not configured - notifications disabled');
      this.initialized = true;
      this.shouldEnable = false;
      return;
    }

    const currentDomain = window.location.hostname;
    const isLocalhost = currentDomain === 'localhost' || currentDomain === '127.0.0.1';

    if (isLocalhost) {
      console.warn('⚠️ OneSignal disabled on localhost (prevents Service Worker conflicts)');
      console.warn('💡 To test notifications, deploy to production');
      this.initialized = true;
      this.shouldEnable = false;
      return;
    }

    const allowedDomains = ['transoflex.netlify.app'];
    if (!allowedDomains.includes(currentDomain)) {
      console.warn('⚠️ OneSignal: Not running on allowed domain:', currentDomain);
      this.initialized = true;
      this.shouldEnable = false;
      return;
    }

    this.shouldEnable = true;

    this.initPromise = new Promise<void>((resolve, reject) => {
      console.log('🚀 Initializing OneSignal...');

      window.OneSignalDeferred = window.OneSignalDeferred || [];

      window.OneSignalDeferred.push(async function(OneSignal: any) {
        try {
          console.log('⚙️ Configuring OneSignal...');

          await OneSignal.init({
            appId: ONESIGNAL_APP_ID,
            safari_web_id: undefined,
            notifyButton: { enable: false },
            allowLocalhostAsSecureOrigin: false,
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
        reject(new Error('OneSignal SDK timeout'));
      }, 15000);
    });

    try {
      await this.initPromise;
      this.initialized = true;
      console.log('✅ OneSignal initialization complete');
    } catch (error: any) {
      console.error('❌ Failed to initialize OneSignal:', error);
      this.initialized = true;
      this.shouldEnable = false;
      throw error;
    } finally {
      this.initPromise = null;
    }
  }

  private static async ensureServiceWorkerReady(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      console.error('❌ Service Workers not supported');
      return false;
    }

    try {
      console.log('⏳ Waiting for Service Worker to be ready...');
      const registration = await navigator.serviceWorker.ready;

      if (!registration) {
        console.error('❌ No Service Worker registration available');
        return false;
      }

      if (!registration.active) {
        console.error('❌ Service Worker registration has no active worker');
        return false;
      }

      if (registration.active.state !== 'activated') {
        console.error('❌ Service Worker is not in activated state:', registration.active.state);
        return false;
      }

      console.log('✅ Service Worker is ready and activated');
      return true;
    } catch (error) {
      console.error('❌ Failed to check Service Worker:', error);
      return false;
    }
  }

  static async requestPermission(): Promise<boolean> {
    if (!this.shouldEnable) {
      console.warn('⚠️ OneSignal not enabled in this environment');
      return false;
    }

    if (!window.OneSignal) {
      console.warn('⚠️ OneSignal SDK not loaded');
      return false;
    }

    const swReady = await this.ensureServiceWorkerReady();
    if (!swReady) {
      console.error('❌ Cannot request permission: Service Worker not ready');
      return false;
    }

    try {
      const permission = await window.OneSignal.Notifications.permission;
      if (permission === 'granted') {
        console.log('✅ Notification permission already granted');
        return true;
      }

      console.log('📱 Requesting notification permission...');
      const result = await window.OneSignal.Notifications.requestPermission();
      console.log('📱 Permission result:', result);
      return result === true;
    } catch (error) {
      console.error('❌ Failed to request notification permission:', error);
      return false;
    }
  }

  static async subscribeUser(
    userAccountId: string,
    role: 'driver' | 'supervisor' | 'admin',
    driverId?: string
  ): Promise<NotificationSubscription | null> {
    console.log('🔔 Starting subscription process...', { userAccountId, role, driverId });

    if (!this.shouldEnable) {
      throw new Error('Benachrichtigungen sind in dieser Umgebung nicht verfügbar');
    }

    if (!this.initialized) {
      console.log('🚀 OneSignal not initialized, initializing now...');
      await this.initialize();
    }

    if (!window.OneSignal) {
      throw new Error('OneSignal SDK nicht geladen');
    }

    if (!supabase) {
      throw new Error('Datenbank nicht verfügbar');
    }

    const swReady = await this.ensureServiceWorkerReady();
    if (!swReady) {
      throw new Error('Service Worker nicht bereit. Bitte laden Sie die Seite neu.');
    }

    try {
      console.log('📱 Requesting notification permission...');
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        throw new Error('Bitte erlauben Sie Benachrichtigungen im Browser');
      }

      console.log('✅ Permission granted');
      await new Promise(resolve => setTimeout(resolve, 500));

      const externalId = `user_${userAccountId}`;

      const { data: existingData } = await supabase
        .from('notification_subscriptions')
        .select('*')
        .eq('user_account_id', userAccountId)
        .maybeSingle();

      const isAlreadyLoggedIn = existingData?.onesignal_external_id === externalId;

      if (!isAlreadyLoggedIn) {
        console.log('🔑 Logging in to OneSignal...');
        try {
          await window.OneSignal.logout();
        } catch (e) {
          console.log('ℹ️ No previous session to logout');
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        await window.OneSignal.login(externalId);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log('✅ Already logged in to OneSignal');
      }

      console.log('🔑 Getting player ID...');
      const playerId = await window.OneSignal.User.PushSubscription.id;
      console.log('✅ Player ID:', playerId);

      console.log('💾 Saving to database...');

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
      console.error('❌ Failed to subscribe user to notifications:', error);
      throw error;
    }
  }

  static async unsubscribeUser(userAccountId: string): Promise<boolean> {
    if (!this.shouldEnable || !window.OneSignal || !supabase) {
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

  static isEnabled(): boolean {
    return this.shouldEnable;
  }
}
