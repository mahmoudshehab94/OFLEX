import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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

    // GET - Query logs with filters
    if (method === "GET") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const mode = url.searchParams.get("mode") || "vehicle";
      const vehicle = url.searchParams.get("vehicle");
      const driver = url.searchParams.get("driver");

      let query = supabase
        .from("work_logs")
        .select(`
          *,
          driver:drivers!work_logs_driver_code_fkey(code, name)
        `)
        .order("work_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (from) {
        query = query.gte("work_date", from);
      }
      if (to) {
        query = query.lte("work_date", to);
      }

      if (mode === "all") {
        // No additional filters, return all logs in date range
      } else if (mode === "vehicle" && vehicle) {
        query = query.ilike("car_number", `%${vehicle}%`);
      } else if (mode === "driver" && driver) {
        const driverCodeMatch = driver.match(/^\d+$/);
        if (driverCodeMatch) {
          query = query.eq("driver_code", parseInt(driver));
        } else {
          const { data: matchingDrivers } = await supabase
            .from("drivers")
            .select("code")
            .ilike("name", `%${driver}%`);

          if (matchingDrivers && matchingDrivers.length > 0) {
            const codes = matchingDrivers.map(d => d.code);
            query = query.in("driver_code", codes);
          } else {
            query = query.eq("driver_code", -1);
          }
        }
      } else if (mode === "both" && vehicle && driver) {
        query = query.ilike("car_number", `%${vehicle}%`);

        const driverCodeMatch = driver.match(/^\d+$/);
        if (driverCodeMatch) {
          query = query.eq("driver_code", parseInt(driver));
        } else {
          const { data: matchingDrivers } = await supabase
            .from("drivers")
            .select("code")
            .ilike("name", `%${driver}%`);

          if (matchingDrivers && matchingDrivers.length > 0) {
            const codes = matchingDrivers.map(d => d.code);
            query = query.in("driver_code", codes);
          } else {
            query = query.eq("driver_code", -1);
          }
        }
      }

      const { data: logs, error } = await query;

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ logs }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // POST - Create or Delete logs
    if (method === "POST") {
      const body = await req.json();
      const { action, id, ids, from, to, code, car, driverCode, vehicle, date, startTime, endTime, pauseMinutes, note, forceCreate } = body;

      if (action === "create") {
        if (!driverCode || !vehicle || !date || !startTime || !endTime) {
          return new Response(
            JSON.stringify({ error: "Pflichtfelder fehlen" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const parsedDriverCode = parseInt(driverCode);
        if (isNaN(parsedDriverCode)) {
          return new Response(
            JSON.stringify({ error: "Ungültiger Fahrer-Code" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { data: driverExists } = await supabase
          .from("drivers")
          .select("code")
          .eq("code", parsedDriverCode)
          .maybeSingle();

        if (!driverExists) {
          return new Response(
            JSON.stringify({ error: "Fahrer nicht gefunden" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        if (!forceCreate) {
          const { data: existingEntry } = await supabase
            .from("work_logs")
            .select("id")
            .eq("driver_code", parsedDriverCode)
            .eq("work_date", date)
            .maybeSingle();

          if (existingEntry) {
            return new Response(
              JSON.stringify({ error: "Für diesen Tag existiert bereits ein Eintrag." }),
              {
                status: 409,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        }

        const startParts = startTime.split(':');
        const endParts = endTime.split(':');
        const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
        let endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);

        if (endMinutes <= startMinutes) {
          endMinutes += 24 * 60;
        }

        const pause = pauseMinutes ? parseInt(pauseMinutes) : 0;
        const totalMinutes = endMinutes - startMinutes - pause;
        const overtimeMinutes = Math.max(0, totalMinutes - (8 * 60));

        const { data, error } = await supabase
          .from("work_logs")
          .insert({
            driver_code: parsedDriverCode,
            car_number: vehicle,
            work_date: date,
            start_time: startTime + ':00',
            end_time: endTime + ':00',
            duration_minutes: totalMinutes,
            overtime_minutes: overtimeMinutes,
          })
          .select()
          .single();

        if (error) {
          console.error("Error creating entry:", error);
          return new Response(
            JSON.stringify({ error: "Fehler beim Erstellen des Eintrags" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify({ success: true, entry: data }),
          {
            status: 201,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (action === "delete") {
        // Single delete by ID
        if (id) {
          const { error } = await supabase
            .from("work_logs")
            .delete()
            .eq("id", id);

          if (error) throw error;

          return new Response(
            JSON.stringify({ success: true, deleted: 1 }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Bulk delete by IDs
        if (ids && Array.isArray(ids)) {
          const { error } = await supabase
            .from("work_logs")
            .delete()
            .in("id", ids);

          if (error) throw error;

          return new Response(
            JSON.stringify({ success: true, deleted: ids.length }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Bulk delete by filters
        let query = supabase.from("work_logs").delete();

        if (from) {
          query = query.gte("work_date", from);
        }
        if (to) {
          query = query.lte("work_date", to);
        }
        if (code) {
          query = query.eq("driver_code", parseInt(code));
        }
        if (car) {
          query = query.ilike("car_number", `%${car}%`);
        }

        const { count, error } = await query.select("*", { count: "exact", head: false });

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, deleted: count || 0 }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ error: "Ungültige Aktion" }),
        {
          status: 400,
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
