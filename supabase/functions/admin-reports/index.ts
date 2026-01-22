import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

function getDateRangeInVienna(daysAgo: number): { from: string; to: string } {
  const today = getTodayInVienna();
  const todayDate = new Date(today);
  const fromDate = new Date(todayDate);
  fromDate.setDate(fromDate.getDate() - daysAgo);

  const from = fromDate.toISOString().split("T")[0];
  return { from, to: today };
}

function getMonthToDateInVienna(): { from: string; to: string } {
  const today = getTodayInVienna();
  const year = today.substring(0, 4);
  const month = today.substring(5, 7);
  const from = `${year}-${month}-01`;

  return { from, to: today };
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
    const type = url.searchParams.get("type");
    const driverParam = url.searchParams.get("driver");

    // Quick summary reports: today, 7days, 30days, MTD
    if (type === "summary") {
      if (!driverParam) {
        return new Response(
          JSON.stringify({ error: "Fahrer-Parameter erforderlich" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      let driverCode: number;
      const driverCodeMatch = driverParam.match(/^\d+$/);
      if (driverCodeMatch) {
        driverCode = parseInt(driverParam);
      } else {
        const { data: matchingDrivers } = await supabase
          .from("drivers")
          .select("code")
          .ilike("name", `%${driverParam}%`)
          .limit(1);

        if (!matchingDrivers || matchingDrivers.length === 0) {
          return new Response(
            JSON.stringify({ error: "Fahrer nicht gefunden" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        driverCode = matchingDrivers[0].code;
      }

      const today = getTodayInVienna();
      const last7Days = getDateRangeInVienna(6);
      const last30Days = getDateRangeInVienna(29);
      const monthToDate = getMonthToDateInVienna();

      const { data: todayLogs } = await supabase
        .from("work_logs")
        .select("duration_minutes, overtime_minutes")
        .eq("driver_code", driverCode)
        .eq("work_date", today);

      const { data: logs7Days } = await supabase
        .from("work_logs")
        .select("duration_minutes, overtime_minutes")
        .eq("driver_code", driverCode)
        .gte("work_date", last7Days.from)
        .lte("work_date", last7Days.to);

      const { data: logs30Days } = await supabase
        .from("work_logs")
        .select("duration_minutes, overtime_minutes")
        .eq("driver_code", driverCode)
        .gte("work_date", last30Days.from)
        .lte("work_date", last30Days.to);

      const { data: logsMTD } = await supabase
        .from("work_logs")
        .select("duration_minutes, overtime_minutes")
        .eq("driver_code", driverCode)
        .gte("work_date", monthToDate.from)
        .lte("work_date", monthToDate.to);

      const aggregateLogs = (logs: any[]) => {
        let totalDuration = 0;
        let totalOvertime = 0;

        logs?.forEach((log) => {
          totalDuration += log.duration_minutes;
          totalOvertime += log.overtime_minutes;
        });

        return {
          duration_minutes: totalDuration,
          overtime_minutes: totalOvertime,
        };
      };

      return new Response(
        JSON.stringify({
          today: aggregateLogs(todayLogs || []),
          last_7_days: aggregateLogs(logs7Days || []),
          last_30_days: aggregateLogs(logs30Days || []),
          month_to_date: aggregateLogs(logsMTD || []),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Monthly totals report
    if (type === "monthly") {
      const year = url.searchParams.get("year");
      const month = url.searchParams.get("month");

      if (!year || !month) {
        return new Response(
          JSON.stringify({ error: "Jahr und Monat sind erforderlich" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!driverParam) {
        return new Response(
          JSON.stringify({ error: "Fahrer-Parameter erforderlich" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      let driverCode: number;
      const driverCodeMatch = driverParam.match(/^\d+$/);
      if (driverCodeMatch) {
        driverCode = parseInt(driverParam);
      } else {
        const { data: matchingDrivers } = await supabase
          .from("drivers")
          .select("code")
          .ilike("name", `%${driverParam}%`)
          .limit(1);

        if (!matchingDrivers || matchingDrivers.length === 0) {
          return new Response(
            JSON.stringify({ error: "Fahrer nicht gefunden" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        driverCode = matchingDrivers[0].code;
      }

      const { data: driverInfo } = await supabase
        .from("drivers")
        .select("code, name")
        .eq("code", driverCode)
        .single();

      const from = `${year}-${month.padStart(2, "0")}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const to = `${year}-${month.padStart(2, "0")}-${lastDay}`;

      const { data: logs } = await supabase
        .from("work_logs")
        .select(`
          work_date,
          duration_minutes,
          overtime_minutes
        `)
        .eq("driver_code", driverCode)
        .gte("work_date", from)
        .lte("work_date", to)
        .order("work_date", { ascending: true });

      let totalDuration = 0;
      let totalOvertime = 0;
      const logDetails: any[] = [];

      logs?.forEach((log) => {
        totalDuration += log.duration_minutes;
        totalOvertime += log.overtime_minutes;
        logDetails.push({
          date: log.work_date,
          duration_minutes: log.duration_minutes,
          overtime_minutes: log.overtime_minutes,
        });
      });

      return new Response(
        JSON.stringify({
          year,
          month,
          driver: {
            code: driverInfo?.code,
            name: driverInfo?.name || "Unknown",
            days_worked: logs?.length || 0,
            total_duration_minutes: totalDuration,
            total_overtime_minutes: totalOvertime,
            logs: logDetails,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Date range report
    if (type === "daterange") {
      const fromDate = url.searchParams.get("from_date");
      const toDate = url.searchParams.get("to_date");

      if (!fromDate || !toDate) {
        return new Response(
          JSON.stringify({ error: "from_date und to_date sind erforderlich" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!driverParam) {
        return new Response(
          JSON.stringify({ error: "Fahrer-Parameter erforderlich" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      let driverCode: number;
      const driverCodeMatch = driverParam.match(/^\d+$/);
      if (driverCodeMatch) {
        driverCode = parseInt(driverParam);
      } else {
        const { data: matchingDrivers } = await supabase
          .from("drivers")
          .select("code")
          .ilike("name", `%${driverParam}%`)
          .limit(1);

        if (!matchingDrivers || matchingDrivers.length === 0) {
          return new Response(
            JSON.stringify({ error: "Fahrer nicht gefunden" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        driverCode = matchingDrivers[0].code;
      }

      const { data: driverInfo } = await supabase
        .from("drivers")
        .select("code, name")
        .eq("code", driverCode)
        .single();

      const { data: logs } = await supabase
        .from("work_logs")
        .select(`
          work_date,
          car_number,
          start_time,
          end_time,
          duration_minutes,
          overtime_minutes
        `)
        .eq("driver_code", driverCode)
        .gte("work_date", fromDate)
        .lte("work_date", toDate)
        .order("work_date", { ascending: true });

      let totalDuration = 0;
      let totalOvertime = 0;
      const logDetails: any[] = [];

      logs?.forEach((log) => {
        totalDuration += log.duration_minutes;
        totalOvertime += log.overtime_minutes;
        logDetails.push({
          date: log.work_date,
          car_number: log.car_number,
          start_time: log.start_time,
          end_time: log.end_time,
          duration_minutes: log.duration_minutes,
          overtime_minutes: log.overtime_minutes,
        });
      });

      return new Response(
        JSON.stringify({
          driver: {
            code: driverInfo?.code,
            name: driverInfo?.name || "Unknown",
            days_worked: logs?.length || 0,
            total_duration_minutes: totalDuration,
            total_overtime_minutes: totalOvertime,
            logs: logDetails,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ungültiger Report-Typ" }),
      {
        status: 400,
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
