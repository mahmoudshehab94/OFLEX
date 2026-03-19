import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userId = authHeader.replace("Bearer ", "");

    const { data: userAccount, error: userError } = await supabase
      .from("user_accounts")
      .select("id, role")
      .eq("id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (userError || !userAccount || userAccount.role !== "admin") {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized - Admin access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { action, vehicleData } = await req.json();

    if (action === "create") {
      const { error } = await supabase
        .from("vehicles")
        .insert({
          id: vehicleData.id,
          plate_letters: vehicleData.plate_letters,
          plate_number: vehicleData.plate_number,
          vehicle_code_image_url: vehicleData.vehicle_code_image_url,
          cooling_code_image_url: vehicleData.cooling_code_image_url,
          standard_code_image_url: vehicleData.standard_code_image_url,
        });

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else if (action === "update") {
      const { error } = await supabase
        .from("vehicles")
        .update({
          plate_letters: vehicleData.plate_letters,
          plate_number: vehicleData.plate_number,
          vehicle_code_image_url: vehicleData.vehicle_code_image_url,
          cooling_code_image_url: vehicleData.cooling_code_image_url,
          standard_code_image_url: vehicleData.standard_code_image_url,
        })
        .eq("id", vehicleData.id);

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else if (action === "delete") {
      const { error } = await supabase
        .from("vehicles")
        .delete()
        .eq("id", vehicleData.id);

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
