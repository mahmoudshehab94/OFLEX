import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface UpdateUserRequest {
  userId: string;
  email?: string;
  username?: string;
  sessionUserId: string;
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: UpdateUserRequest = await req.json();
    const { userId, email, username, sessionUserId } = body;

    console.log('Received request:', { userId, email, username, sessionUserId });

    if (!userId || !sessionUserId) {
      console.error('Missing fields:', { userId, sessionUserId });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields',
          details: { userId: !!userId, sessionUserId: !!sessionUserId }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: sessionUser, error: sessionError } = await supabase
      .from('user_accounts')
      .select('role, is_active')
      .eq('id', sessionUserId)
      .maybeSingle();

    if (sessionError || !sessionUser || !sessionUser.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (sessionUser.role !== 'admin' && sessionUser.role !== 'supervisor') {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient permissions' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (username !== undefined) updateData.username = username;

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

    if (email !== undefined) {
      const { data: existingEmail } = await supabase
        .from('user_accounts')
        .select('id')
        .eq('email', email)
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

    const { error: updateError } = await supabase
      .from('user_accounts')
      .update(updateData)
      .eq('id', userId);

    if (updateError) {
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

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
