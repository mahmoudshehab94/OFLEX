import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Admin-User-Id',
};

interface CreateAccountRequest {
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

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const adminUserId = req.headers.get('X-Admin-User-Id');
    if (!adminUserId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Admin user ID required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: adminUser, error: adminError } = await supabase
      .from('user_accounts')
      .select('role, is_active')
      .eq('id', adminUserId)
      .maybeSingle();

    if (adminError || !adminUser || adminUser.role !== 'admin' || !adminUser.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body: CreateAccountRequest = await req.json();
    const { fullName, username, emailLocalPart, password, role, driverId, newDriverData } = body;

    if (!fullName || !username || !emailLocalPart || !password || !role) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const emailLocalPattern = /^[a-zA-Z0-9]+$/;
    if (!emailLocalPattern.test(emailLocalPart)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email local part can only contain English letters and numbers' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const email = `${emailLocalPart}@malek.com`;

    const { data: existingEmail } = await supabase
      .from('user_accounts')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email already exists' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: existingUsername } = await supabase
      .from('user_accounts')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingUsername) {
      return new Response(
        JSON.stringify({ success: false, error: 'Username already exists' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
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
        return new Response(
          JSON.stringify({ success: false, error: 'Driver code already exists' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
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
        return new Response(
          JSON.stringify({ success: false, error: driverError?.message || 'Failed to create driver' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
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
        is_active: true,
      })
      .select()
      .single();

    if (accountError || !newAccount) {
      return new Response(
        JSON.stringify({ success: false, error: accountError?.message || 'Failed to create account' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        accountId: newAccount.id,
        driverId: finalDriverId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating account:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
