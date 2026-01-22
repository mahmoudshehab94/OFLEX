import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generateToken(userId: string, username: string): string {
  const tokenData = {
    userId,
    username,
    timestamp: Date.now(),
    random: crypto.randomUUID()
  };
  return btoa(JSON.stringify(tokenData));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Methode nicht erlaubt" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: "Benutzername und Passwort erforderlich" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: verifyResult, error: verifyError } = await supabase.rpc(
      'verify_admin_password',
      { p_username: username, p_password: password }
    );

    if (verifyError) {
      console.error("Database error:", verifyError);
      console.error("Error details:", JSON.stringify(verifyError, null, 2));
      return new Response(
        JSON.stringify({
          error: "Interner Serverfehler",
          details: verifyError.message || String(verifyError)
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!verifyResult || !verifyResult.success) {
      return new Response(
        JSON.stringify({ error: verifyResult?.message || "Ungültige Anmeldedaten" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = generateToken(verifyResult.user_id, username);

    return new Response(
      JSON.stringify({
        success: true,
        token,
        username,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Interner Serverfehler" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
