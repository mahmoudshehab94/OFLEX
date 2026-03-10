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

    console.log('Updating user_accounts with:', updateData);

    const { data, error: updateError } = await supabase
      .from('user_accounts')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Update successful:', data);

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
