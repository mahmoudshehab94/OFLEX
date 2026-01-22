import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SubmitRequest {
  code: number;
  car_number: string;
  start_time: string;
  end_time: string;
}

function calculateDurationMinutes(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const startMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;

  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return endMinutes - startMinutes;
}

function calculateOvertimeMinutes(durationMinutes: number): number {
  const standardMinutes = 540;
  return Math.max(0, durationMinutes - standardMinutes);
}

function getTodayInVienna(): string {
  const now = new Date();
  const viennaTime = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return viennaTime;
}

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

    const body: SubmitRequest = await req.json();
    const { code, car_number, start_time, end_time } = body;

    if (!code || !car_number || !start_time || !end_time) {
      return new Response(
        JSON.stringify({ error: "Alle Felder sind erforderlich" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const workDate = getTodayInVienna();

    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("code, name, active")
      .eq("code", code)
      .maybeSingle();

    if (driverError || !driver) {
      return new Response(
        JSON.stringify({ error: "Ungültiger Code" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!driver.active) {
      return new Response(
        JSON.stringify({ error: "Dieser Code ist deaktiviert" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: existingLog } = await supabase
      .from("work_logs")
      .select("id")
      .eq("driver_code", code)
      .eq("work_date", workDate)
      .maybeSingle();

    if (existingLog) {
      return new Response(
        JSON.stringify({ error: "Dieser Code wurde heute bereits verwendet" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const durationMinutes = calculateDurationMinutes(start_time, end_time);
    const overtimeMinutes = calculateOvertimeMinutes(durationMinutes);

    const { error: insertError } = await supabase
      .from("work_logs")
      .insert({
        driver_code: code,
        work_date: workDate,
        car_number,
        start_time,
        end_time,
        duration_minutes: durationMinutes,
        overtime_minutes: overtimeMinutes,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Fehler beim Speichern" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Erfolgreich gespeichert",
        driver_name: driver.name,
        duration_minutes: durationMinutes,
        overtime_minutes: overtimeMinutes,
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
