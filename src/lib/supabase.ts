import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = !!(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig) {
  console.warn('⚠️ Supabase environment variables are missing');
  console.error('❌ CRITICAL: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY not configured');
} else {
  const expectedUrlPattern = /^https:\/\/[a-z0-9-]+\.supabase\.co$/;
  if (!expectedUrlPattern.test(supabaseUrl)) {
    console.error('❌ CRITICAL: Supabase URL format appears invalid. Expected format: https://[project-id].supabase.co');
  } else {
    console.log('✅ Supabase configuration loaded from environment variables');
  }
}

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface Driver {
  id: string;
  driver_code: string;
  driver_name: string;
  license_letters: string | null;
  license_numbers: string | null;
  is_active: boolean;
  created_at: string;
  account_email?: string | null;
  account_username?: string | null;
  account_id?: string | null;
}

export interface WorkEntry {
  id: string;
  driver_id: string;
  vehicle: string;
  date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  notes: string | null;
  created_at: string;
}

export interface DriverWithWorkEntries extends Driver {
  work_entries: WorkEntry[];
}

export interface AdminSettings {
  id: string;
  password: string;
  updated_at: string;
}

export interface AccountInvite {
  id: string;
  token: string;
  role: 'driver' | 'supervisor' | 'admin';
  driver_id: string | null;
  created_by: string | null;
  expires_at: string;
  used_at: string | null;
  is_used: boolean;
  created_at: string;
  new_driver_code?: string | null;
  new_driver_name?: string | null;
  new_driver_license_letters?: string | null;
  new_driver_license_numbers?: string | null;
}

export async function testDatabaseConnection(): Promise<{
  success: boolean;
  message: string;
  error?: any;
  details?: any;
}> {
  if (!supabase) {
    return {
      success: false,
      message: 'Supabase client not initialized (missing env vars)',
    };
  }

  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('id')
      .limit(1);

    if (error) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
        error: error,
        details: {
          code: error.code,
          hint: error.hint,
          details: error.details,
        }
      };
    }

    return {
      success: true,
      message: 'Connection successful',
      details: { recordCount: data?.length || 0 }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Unexpected error: ${error.message}`,
      error: error
    };
  }
}

export function getConfigStatus() {
  return {
    hasUrl: !!import.meta.env.VITE_SUPABASE_URL,
    hasAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
    hasAdminPassword: !!import.meta.env.VITE_ADMIN_PASSWORD,
    urlValue: import.meta.env.VITE_SUPABASE_URL || '(not set)',
  };
}

export async function generateInviteToken(
  role: 'driver' | 'supervisor' | 'admin',
  createdBy: string,
  driverId?: string,
  newDriverData?: { code: string; name: string; license_letters: string; license_numbers: string }
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const inviteData: any = {
      token,
      role,
      created_by: createdBy,
      expires_at: expiresAt.toISOString(),
      is_used: false,
    };

    if (driverId) {
      inviteData.driver_id = driverId;
    } else if (newDriverData) {
      inviteData.new_driver_code = newDriverData.code;
      inviteData.new_driver_name = newDriverData.name;
      inviteData.new_driver_license_letters = newDriverData.license_letters || null;
      inviteData.new_driver_license_numbers = newDriverData.license_numbers || null;
    }

    const { data, error } = await supabase
      .from('account_invites')
      .insert(inviteData)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, token };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function validateInviteToken(
  token: string
): Promise<{ valid: boolean; invite?: AccountInvite; error?: string }> {
  if (!supabase) {
    return { valid: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('account_invites')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !data) {
      return { valid: false, error: 'Invalid invite token' };
    }

    if (data.is_used) {
      return { valid: false, error: 'Invite has already been used' };
    }

    if (new Date(data.expires_at) < new Date()) {
      return { valid: false, error: 'Invite has expired' };
    }

    return { valid: true, invite: data };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

export async function markInviteAsUsed(
  token: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { error } = await supabase
      .from('account_invites')
      .update({
        is_used: true,
        used_at: new Date().toISOString(),
      })
      .eq('token', token)
      .eq('is_used', false);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function uploadAvatar(
  file: File,
  userId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    return { success: true, url: data.publicUrl };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export function generatePassword(length: number = 12): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  const allChars = lowercase + uppercase + numbers + symbols;

  let password = '';
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Export hashPassword so it can be used in other components
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const passwordHash = await hashPassword(newPassword);
    console.log('Resetting password for user:', userId);
    console.log('New password hash:', passwordHash);

    const { error, data } = await supabase
      .from('user_accounts')
      .update({ password_hash: passwordHash })
      .eq('id', userId)
      .select();

    console.log('Update result:', { error, data });

    if (error) {
      console.error('Password reset error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Password reset exception:', error);
    return { success: false, error: error.message };
  }
}

export async function updateUserEmail(
  userId: string,
  newEmail: string,
  sessionUserId: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const apiUrl = `${supabaseUrl}/functions/v1/admin-update-user`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        email: newEmail,
        sessionUserId,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Failed to update email' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export interface UserAccount {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'supervisor' | 'driver';
  driver_id: string | null;
  avatar_url: string | null;
  created_at: string;
  driver_name?: string | null;
}

export async function getAllUserAccounts(): Promise<{ success: boolean; users?: UserAccount[]; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('user_accounts')
      .select('*, drivers(driver_name)')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const users = data?.map((account: any) => ({
      ...account,
      driver_name: account.drivers?.driver_name || null,
      drivers: undefined
    }));

    return { success: true, users };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getDriversWithAccounts(): Promise<{ success: boolean; drivers?: Driver[]; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('drivers')
      .select(`
        *,
        user_accounts!fk_driver(id, email, username)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const drivers = data?.map((driver: any) => {
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

    return { success: true, drivers };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export interface CreateAccountDirectParams {
  fullName: string;
  username: string;
  emailLocalPart: string;
  password: string;
  role: 'driver' | 'supervisor';
  driverId?: string;
  newDriverData?: {
    code: string;
  };
}

export async function createAccountDirect(
  params: CreateAccountDirectParams,
  createdByUserId: string
): Promise<{ success: boolean; accountId?: string; driverId?: string; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { fullName, username, emailLocalPart, password, role, driverId, newDriverData } = params;

    const emailLocalPattern = /^[a-zA-Z0-9]+$/;
    if (!emailLocalPattern.test(emailLocalPart)) {
      return { success: false, error: 'Email local part can only contain English letters and numbers' };
    }

    const email = `${emailLocalPart}@malek.com`;

    const { data: existingEmail } = await supabase
      .from('user_accounts')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingEmail) {
      return { success: false, error: 'Email already exists' };
    }

    const { data: existingUsername } = await supabase
      .from('user_accounts')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingUsername) {
      return { success: false, error: 'Username already exists' };
    }

    const passwordHash = await hashPassword(password);

    let finalDriverId = driverId;

    if (role === 'driver' && !driverId && newDriverData) {
      const { data: existingDriver } = await supabase
        .from('drivers')
        .select('id')
        .eq('driver_code', newDriverData.code)
        .maybeSingle();

      if (existingDriver) {
        return { success: false, error: 'Driver code already exists' };
      }

      const { data: newDriver, error: driverError } = await supabase
        .from('drivers')
        .insert({
          driver_code: newDriverData.code,
          driver_name: fullName,
          license_letters: null,
          license_numbers: null,
          is_active: true,
        })
        .select()
        .single();

      if (driverError || !newDriver) {
        return { success: false, error: driverError?.message || 'Failed to create driver' };
      }

      finalDriverId = newDriver.id;
    }

    const { data: newAccount, error: accountError } = await supabase
      .from('user_accounts')
      .insert({
        email,
        username,
        password_hash: passwordHash,
        role,
        driver_id: role === 'driver' ? finalDriverId : null,
        full_name: fullName,
      })
      .select()
      .single();

    if (accountError || !newAccount) {
      return { success: false, error: accountError?.message || 'Failed to create account' };
    }

    return {
      success: true,
      accountId: newAccount.id,
      driverId: finalDriverId
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
