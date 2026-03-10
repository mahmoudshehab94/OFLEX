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
  driverId?: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const { data, error } = await supabase
      .from('account_invites')
      .insert({
        token,
        role,
        created_by: createdBy,
        driver_id: driverId || null,
        expires_at: expiresAt.toISOString(),
        is_used: false,
      })
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
