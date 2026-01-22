import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function checkAdminAuth(req: Request): boolean {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) return false;

  const token = authHeader.replace("Bearer ", "");

  try {
    const decoded = JSON.parse(atob(token));

    if (!decoded.userId || !decoded.username || !decoded.timestamp) {
      return false;
    }

    const tokenAge = Date.now() - decoded.timestamp;
    const maxAge = 24 * 60 * 60 * 1000;

    if (tokenAge > maxAge) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (!checkAdminAuth(req)) {
      return new Response(
        JSON.stringify({ error: "Nicht autorisiert" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const method = req.method;

    // GET - List all drivers
    if (method === "GET") {
      const { data: drivers, error } = await supabase
        .from("drivers")
        .select("*")
        .order("code", { ascending: true });

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ drivers }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // POST - Add new driver
    if (method === "POST") {
      const body = await req.json();
      const { code, name, active } = body;

      if (!code || !name) {
        return new Response(
          JSON.stringify({ error: "Code und Name sind erforderlich" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data, error } = await supabase
        .from("drivers")
        .insert({
          code: parseInt(code),
          name,
          active: active !== undefined ? active : true,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return new Response(
            JSON.stringify({ error: "Dieser Code existiert bereits" }),
            {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        throw error;
      }

      return new Response(
        JSON.stringify({ driver: data }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // PATCH - Update driver
    if (method === "PATCH") {
      const body = await req.json();
      const { code, name, active } = body;

      if (!code) {
        return new Response(
          JSON.stringify({ error: "Code ist erforderlich" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (active !== undefined) updates.active = active;

      const { data, error } = await supabase
        .from("drivers")
        .update(updates)
        .eq("code", parseInt(code))
        .select()
        .single();

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ driver: data }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // DELETE - Force delete driver (cascade delete all entries)
    if (method === "DELETE") {
      const body = await req.json();
      const { code, force } = body;

      if (!code) {
        return new Response(
          JSON.stringify({ error: "Code ist erforderlich" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // First, delete all work logs for this driver
      const { error: logsError } = await supabase
        .from("work_logs")
        .delete()
        .eq("driver_code", parseInt(code));

      if (logsError) {
        console.error("Error deleting work logs:", logsError);
        return new Response(
          JSON.stringify({ error: "Fehler beim Löschen der Einträge" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Then delete the driver
      const { error: driverError } = await supabase
        .from("drivers")
        .delete()
        .eq("code", parseInt(code));

      if (driverError) {
        console.error("Error deleting driver:", driverError);
        return new Response(
          JSON.stringify({ error: "Fehler beim Löschen des Fahrers" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Methode nicht erlaubt" }),
      {
        status: 405,
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
