import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID") || "";
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Driver {
  id: string;
  driver_name: string;
  driver_code: string;
  is_active: boolean;
}

interface NotificationSubscription {
  id: string;
  user_account_id: string;
  onesignal_external_id: string;
  role: string;
  driver_id: string | null;
  enabled: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const currentHour = now.getHours();

    // Only run after 18:00 (6 PM)
    if (currentHour < 18) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Too early - reminders only sent after 18:00",
          time: now.toISOString(),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const today = now.toISOString().split("T")[0];

    // Get all active drivers
    const { data: drivers, error: driversError } = await supabase
      .from("drivers")
      .select("id, driver_name, driver_code, is_active")
      .eq("is_active", true);

    if (driversError) throw driversError;

    if (!drivers || drivers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No active drivers found",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get all work entries for today
    const { data: todayEntries, error: entriesError } = await supabase
      .from("work_entries")
      .select("driver_id")
      .eq("work_date", today);

    if (entriesError) throw entriesError;

    const driversWithSubmissions = new Set(
      (todayEntries || []).map((entry) => entry.driver_id)
    );

    // Find drivers who haven't submitted yet
    const driversNeedingReminder = drivers.filter(
      (driver: Driver) => !driversWithSubmissions.has(driver.id)
    );

    if (driversNeedingReminder.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "All drivers have submitted their work entries",
          date: today,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check which drivers were already reminded in the last 30 minutes
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

    const { data: recentReminders, error: remindersError } = await supabase
      .from("notification_reminders_log")
      .select("driver_id, sent_at")
      .eq("reminder_date", today)
      .eq("reminder_type", "driver")
      .gte("sent_at", thirtyMinutesAgo);

    if (remindersError) throw remindersError;

    const recentlyRemindedDrivers = new Set(
      (recentReminders || []).map((r) => r.driver_id)
    );

    const driversToRemind = driversNeedingReminder.filter(
      (driver: Driver) => !recentlyRemindedDrivers.has(driver.id)
    );

    let driverNotificationsSent = 0;

    // Send reminders to individual drivers
    for (const driver of driversToRemind) {
      const { data: subscription } = await supabase
        .from("notification_subscriptions")
        .select("*")
        .eq("driver_id", driver.id)
        .eq("enabled", true)
        .maybeSingle();

      if (subscription && subscription.onesignal_external_id) {
        try {
          const message = {
            app_id: ONESIGNAL_APP_ID,
            include_external_user_ids: [subscription.onesignal_external_id],
            headings: { en: "⏰ تذكير بتسجيل ساعات العمل" },
            contents: {
              en: `مرحبا ${driver.driver_name}، لم تسجل ساعات العمل اليوم بعد. يرجى تسجيل الدخول وإكمال التسجيل.`,
            },
            data: {
              type: "work_reminder",
              driver_id: driver.id,
              date: today,
            },
          };

          const response = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify(message),
          });

          if (response.ok) {
            await supabase.from("notification_reminders_log").insert({
              driver_id: driver.id,
              reminder_date: today,
              sent_at: now.toISOString(),
              reminder_type: "driver",
              message_content: `Reminder sent to ${driver.driver_name}`,
            });

            driverNotificationsSent++;
          }
        } catch (error) {
          console.error(`Failed to send reminder to driver ${driver.id}:`, error);
        }
      }
    }

    // Send summary to supervisors and admins
    if (driversNeedingReminder.length > 0) {
      const { data: supervisorSubscriptions } = await supabase
        .from("notification_subscriptions")
        .select("*")
        .in("role", ["supervisor", "admin"])
        .eq("enabled", true);

      const driverNames = driversNeedingReminder
        .slice(0, 5)
        .map((d: Driver) => d.driver_name)
        .join("، ");

      const additionalCount = Math.max(0, driversNeedingReminder.length - 5);
      const summaryText = additionalCount > 0
        ? `${driverNames} و ${additionalCount} آخرين`
        : driverNames;

      for (const subscription of supervisorSubscriptions || []) {
        // Check if supervisor was already notified in the last 30 minutes
        const { data: recentSupervisorReminder } = await supabase
          .from("notification_reminders_log")
          .select("id")
          .eq("reminder_type", `${subscription.role}_summary`)
          .eq("reminder_date", today)
          .gte("sent_at", thirtyMinutesAgo)
          .maybeSingle();

        if (recentSupervisorReminder) {
          continue; // Skip if already notified recently
        }

        try {
          const message = {
            app_id: ONESIGNAL_APP_ID,
            include_external_user_ids: [subscription.onesignal_external_id],
            headings: { en: "📋 ملخص تسجيل ساعات العمل" },
            contents: {
              en: `${driversNeedingReminder.length} سائق لم يسجلوا ساعات العمل اليوم: ${summaryText}`,
            },
            data: {
              type: "supervisor_summary",
              date: today,
              count: driversNeedingReminder.length,
            },
          };

          const response = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify(message),
          });

          if (response.ok) {
            await supabase.from("notification_reminders_log").insert({
              driver_id: null,
              reminder_date: today,
              sent_at: now.toISOString(),
              reminder_type: `${subscription.role}_summary`,
              message_content: `Summary sent: ${driversNeedingReminder.length} drivers pending`,
            });
          }
        } catch (error) {
          console.error(
            `Failed to send summary to ${subscription.role}:`,
            error
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Reminders sent successfully",
        date: today,
        time: now.toISOString(),
        driversNeedingReminder: driversNeedingReminder.length,
        driverNotificationsSent,
        driversReminded: driversToRemind.map((d: Driver) => ({
          name: d.driver_name,
          code: d.driver_code,
        })),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-daily-reminders:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
