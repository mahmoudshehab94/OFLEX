import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

console.log('🔧 Supabase Configuration:');
console.log('  URL:', supabaseUrl);
console.log('  Anon Key (last 6):', supabaseAnonKey.slice(-6));
console.log('  Service Key (last 6):', supabaseServiceKey ? supabaseServiceKey.slice(-6) : 'NOT SET');

const extractProjectRef = (key: string): string => {
  try {
    const payload = JSON.parse(atob(key.split('.')[1]));
    return payload.ref || 'unknown';
  } catch {
    return 'invalid';
  }
};

const EXPECTED_PROJECT_REF = 'jydiusflnirmtfozdurm';

const urlProjectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const anonProjectRef = extractProjectRef(supabaseAnonKey);
const serviceProjectRef = supabaseServiceKey ? extractProjectRef(supabaseServiceKey) : null;

console.log('🔍 Project References:');
console.log('  Expected Project:', EXPECTED_PROJECT_REF);
console.log('  URL Project:', urlProjectRef);
console.log('  Anon Key Project:', anonProjectRef);
console.log('  Service Key Project:', serviceProjectRef || 'N/A');

if (urlProjectRef !== EXPECTED_PROJECT_REF) {
  const errorMessage = `
╔═══════════════════════════════════════════════════════════════════╗
║                 ❌ WRONG SUPABASE PROJECT CONNECTED ❌              ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  Expected: ${EXPECTED_PROJECT_REF}                                    ║
║  Current:  ${urlProjectRef || 'unknown'}                                         ║
║                                                                   ║
║  Please update your .env file with the correct Supabase          ║
║  project URL and anon key.                                       ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
  `;
  console.error(errorMessage);
  throw new Error(`WRONG SUPABASE PROJECT: Expected "${EXPECTED_PROJECT_REF}", got "${urlProjectRef}"`);
}

if (urlProjectRef !== anonProjectRef) {
  console.error('❌ MISMATCH: URL and Anon Key are for different projects!');
  throw new Error('URL and Anon Key project mismatch');
}
if (serviceProjectRef && urlProjectRef !== serviceProjectRef) {
  console.error('❌ MISMATCH: URL and Service Key are for different projects!');
  throw new Error('URL and Service Key project mismatch');
}

console.log('✅ All credentials match the correct project:', EXPECTED_PROJECT_REF);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export interface Driver {
  code: number;
  name: string;
  active: boolean;
  created_at: string;
}

export interface WorkLog {
  id: number;
  driver_code: number;
  car_number: string;
  work_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  overtime_minutes: number;
  created_at: string;
}

export async function testDatabaseConnection(): Promise<{ success: boolean; message: string; details?: any }> {
  console.log('🔍 Testing database connectivity...');

  try {
    const { count: driversCount, error: driversError } = await supabase
      .from('drivers')
      .select('*', { count: 'exact', head: true });

    if (driversError) {
      console.error('❌ Drivers SELECT test failed:', driversError);
      return {
        success: false,
        message: `Drivers SELECT failed: ${driversError.message}`,
        details: driversError
      };
    }

    console.log('✅ Drivers table accessible');

    const { count: logsCount, error: logsError } = await supabase
      .from('work_logs')
      .select('*', { count: 'exact', head: true });

    if (logsError) {
      console.error('❌ Work logs SELECT test failed:', logsError);
      return {
        success: false,
        message: `Work logs SELECT failed: ${logsError.message}`,
        details: logsError
      };
    }

    console.log('✅ Work logs table accessible');

    return {
      success: true,
      message: 'Database connection successful',
      details: {
        driversCount: driversCount || 0,
        logsCount: logsCount || 0,
        projectRef: urlProjectRef
      }
    };
  } catch (error: any) {
    console.error('❌ Connection test failed:', error);
    return {
      success: false,
      message: error.message || 'Unknown error',
      details: error
    };
  }
}
