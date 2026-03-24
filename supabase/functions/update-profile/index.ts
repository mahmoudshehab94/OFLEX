import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface UpdateProfileRequest {
  userId: string;
  username?: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  password_hash?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const body: UpdateProfileRequest = await req.json();
    const { userId, username, full_name, phone, avatar_url, password_hash } = body;

    console.log('Update profile request:', { userId, username, full_name, phone, avatar_url, hasPassword: !!password_hash });

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'User ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const updateData: any = {};
    if (username !== undefined) updateData.username = username;
    if (full_name !== undefined) updateData.full_name = full_name;
    if (phone !== undefined) updateData.phone = phone;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (password_hash !== undefined) updateData.password_hash = password_hash;

    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No fields to update' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check for unique constraint violations before updating
    if (username !== undefined) {
      const { data: existingUsername } = await supabase
        .from('user_accounts')
        .select('id')
        .eq('username', username)
        .neq('id', userId)
        .maybeSingle();

      if (existingUsername) {
        return new Response(
          JSON.stringify({ success: false, error: 'Benutzername ist bereits vergeben' }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    if (updateData.email !== undefined) {
      const { data: existingEmail } = await supabase
        .from('user_accounts')
        .select('id')
        .eq('email', updateData.email)
        .neq('id', userId)
        .maybeSingle();

      if (existingEmail) {
        return new Response(
          JSON.stringify({ success: false, error: 'E-Mail-Adresse ist bereits vergeben' }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    console.log('Updating user_accounts with:', updateData);

    const { data, error: updateError } = await supabase
      .from('user_accounts')
      .update(updateData)
      .eq('id', userId)
      .select('*, driver_id')
      .single();

    if (updateError) {
      console.error('Update error:', updateError);

      // Provide user-friendly error messages for unique constraint violations
      let errorMessage = updateError.message;
      if (updateError.code === '23505') { // PostgreSQL unique violation code
        if (errorMessage.includes('username')) {
          errorMessage = 'Benutzername ist bereits vergeben';
        } else if (errorMessage.includes('email')) {
          errorMessage = 'E-Mail-Adresse ist bereits vergeben';
        }
      }

      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Update successful:', data);

    // If full_name was updated and user has a driver profile, sync to drivers table
    if (full_name !== undefined && data?.driver_id) {
      console.log('Syncing driver name to drivers table:', { driver_id: data.driver_id, driver_name: full_name });

      const { error: driverUpdateError } = await supabase
        .from('drivers')
        .update({ driver_name: full_name })
        .eq('id', data.driver_id);

      if (driverUpdateError) {
        console.error('Failed to sync driver name:', driverUpdateError);
        // Don't fail the whole request, just log the error
      } else {
        console.log('Driver name synced successfully');
      }
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Exception:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
