import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RegisterRequest {
  inviteToken: string;
  emailLocalPart: string;
  password: string;
  username?: string;
  avatarUrl?: string;
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

    const body: RegisterRequest = await req.json();
    const { inviteToken, emailLocalPart, password, username, avatarUrl } = body;

    // Validate required fields
    if (!inviteToken || !emailLocalPart || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Fehlende erforderliche Felder' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate email local part doesn't contain @
    if (emailLocalPart.includes('@')) {
      return new Response(
        JSON.stringify({ success: false, error: 'E-Mail-Teil darf kein @ enthalten' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate email local part format
    const emailLocalPattern = /^[a-zA-Z0-9._-]+$/;
    if (!emailLocalPattern.test(emailLocalPart)) {
      return new Response(
        JSON.stringify({ success: false, error: 'E-Mail-Teil kann nur Buchstaben, Zahlen, Punkte, Unterstriche und Bindestriche enthalten' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Passwort muss mindestens 6 Zeichen lang sein' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch and validate invitation
    const { data: invite, error: inviteError } = await supabase
      .from('account_invites')
      .select('*')
      .eq('token', inviteToken)
      .eq('status', 'pending')
      .maybeSingle();

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ungültiger oder abgelaufener Einladungstoken' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if invitation has expired (30 days)
    const inviteCreatedAt = new Date(invite.created_at);
    const now = new Date();
    const daysDiff = (now.getTime() - inviteCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 30) {
      return new Response(
        JSON.stringify({ success: false, error: 'Diese Einladung ist abgelaufen' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Construct full email
    const fullEmail = `${emailLocalPart.trim()}@malek.com`;

    // Use username from invitation if provided, otherwise use from request
    const finalUsername = invite.username || username;
    if (!finalUsername) {
      return new Response(
        JSON.stringify({ success: false, error: 'Benutzername ist erforderlich' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if email already exists
    const { data: existingEmail } = await supabase
      .from('user_accounts')
      .select('id')
      .eq('email', fullEmail)
      .maybeSingle();

    if (existingEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'Diese E-Mail-Adresse wird bereits verwendet' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if username already exists
    const { data: existingUsername } = await supabase
      .from('user_accounts')
      .select('id')
      .eq('username', finalUsername)
      .maybeSingle();

    if (existingUsername) {
      return new Response(
        JSON.stringify({ success: false, error: 'Dieser Benutzername wird bereits verwendet' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    let finalDriverId = invite.driver_id;

    // If this is a new driver invitation, create the driver record
    if (invite.role === 'driver' && !invite.driver_id && invite.new_driver_name) {
      const { data: newDriver, error: driverError } = await supabase
        .from('drivers')
        .insert({
          driver_name: invite.new_driver_name,
          license_letters: invite.new_driver_license_letters || null,
          license_numbers: invite.new_driver_license_numbers || null,
          is_active: true,
        })
        .select()
        .single();

      if (driverError || !newDriver) {
        console.error('Failed to create driver:', driverError);
        return new Response(
          JSON.stringify({ success: false, error: 'Fehler beim Erstellen des Fahrerprofils' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      finalDriverId = newDriver.id;
    }

    // Create user account
    const { data: newAccount, error: accountError } = await supabase
      .from('user_accounts')
      .insert({
        email: fullEmail,
        username: finalUsername,
        password_hash: passwordHash,
        role: invite.role,
        driver_id: invite.role === 'driver' ? finalDriverId : null,
        full_name: invite.new_driver_name || finalUsername,
        avatar_url: avatarUrl || null,
        is_active: true,
      })
      .select()
      .single();

    if (accountError || !newAccount) {
      console.error('Failed to create account:', accountError);
      return new Response(
        JSON.stringify({ success: false, error: 'Fehler beim Erstellen des Kontos' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Mark invitation as used
    const { error: updateError } = await supabase
      .from('account_invites')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        used_by_account_id: newAccount.id,
      })
      .eq('id', invite.id);

    if (updateError) {
      console.error('Failed to update invitation status:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        accountId: newAccount.id,
        driverId: finalDriverId,
        username: finalUsername,
        email: fullEmail,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Interner Serverfehler' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
