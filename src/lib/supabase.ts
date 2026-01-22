import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = !!(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig) {
  console.warn('⚠️ Supabase environment variables are missing');
}

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface Driver {
  id: string;
  driver_code: string;
  license_letters: string;
  license_numbers: string;
  created_at: string;
}

export interface WorkTime {
  id: string;
  driver_id: string;
  start_time: string;
  end_time: string;
  work_date: string;
  created_at: string;
}

export interface DriverWithWorkTimes extends Driver {
  work_times: WorkTime[];
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
