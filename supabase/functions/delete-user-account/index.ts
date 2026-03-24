import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DeleteUserRequest {
  userId: string;
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

    const body: DeleteUserRequest = await req.json();
    const { userId, sessionUserId } = body;

    if (!userId || !sessionUserId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields'
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

    if (sessionUser.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Only admins can delete accounts' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (userId === sessionUserId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cannot delete your own account' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: targetUser, error: targetError } = await supabase
      .from('user_accounts')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (targetError || !targetUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (targetUser.role === 'driver') {
      return new Response(
        JSON.stringify({ success: false, error: 'Cannot delete driver accounts through this endpoint' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { error: deleteError } = await supabase
      .from('user_accounts')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      return new Response(
        JSON.stringify({ success: false, error: deleteError.message }),
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
