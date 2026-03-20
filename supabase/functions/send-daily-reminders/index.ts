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
  is_active: boolean;
}

interface NotificationSubscription {
  id: string;
  user_account_id: string;
  onesignal_external_id: string;
  role: string;
  driver_id: string | null;
  enabled: boolean;
  reminder_start_hour: number;
  reminder_interval_minutes: number;
  skip_weekends: boolean;
  last_reminder_sent_at: string | null;
  last_reminder_date: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("🚀 Starting send-daily-reminders function");

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.error("❌ OneSignal credentials not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "OneSignal not configured",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const dayOfWeek = now.getDay();
    const today = now.toISOString().split("T")[0];

    console.log(`📅 Current time: ${now.toISOString()}`);
    console.log(`🕐 Hour: ${currentHour}, Minute: ${currentMinute}, Day: ${dayOfWeek}`);

    const { data: drivers, error: driversError } = await supabase
      .from("drivers")
      .select("id, driver_name, is_active")
      .eq("is_active", true);

    if (driversError) {
      console.error("❌ Error fetching drivers:", driversError);
      throw driversError;
    }

    if (!drivers || drivers.length === 0) {
      console.log("ℹ️ No active drivers found");
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

    console.log(`👥 Found ${drivers.length} active drivers`);

    const { data: todayEntries, error: entriesError } = await supabase
      .from("work_entries")
      .select("driver_id")
      .eq("date", today);

    if (entriesError) {
      console.error("❌ Error fetching work entries:", entriesError);
      throw entriesError;
    }

    const driversWithSubmissions = new Set(
      (todayEntries || []).map((entry) => entry.driver_id)
    );

    console.log(`✅ ${driversWithSubmissions.size} drivers already submitted today`);

    const driversNeedingReminder = drivers.filter(
      (driver: Driver) => !driversWithSubmissions.has(driver.id)
    );

    console.log(`🔔 ${driversNeedingReminder.length} drivers need reminders`);

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

    let driverNotificationsSent = 0;
    const remindedDrivers: string[] = [];
    const skippedDrivers: { name: string; reason: string }[] = [];

    for (const driver of driversNeedingReminder) {
      console.log(`\n👤 Processing driver: ${driver.driver_name} (${driver.id})`);

      const { data: subscription, error: subError } = await supabase
        .from("notification_subscriptions")
        .select("*")
        .eq("driver_id", driver.id)
        .eq("enabled", true)
        .maybeSingle();

      if (subError) {
        console.error(`❌ Error fetching subscription for ${driver.driver_name}:`, subError);
        continue;
      }

      if (!subscription) {
        console.log(`⚠️ No active subscription for ${driver.driver_name}`);
        skippedDrivers.push({ name: driver.driver_name, reason: "No subscription" });
        continue;
      }

      if (!subscription.onesignal_external_id) {
        console.log(`⚠️ No OneSignal ID for ${driver.driver_name}`);
        skippedDrivers.push({ name: driver.driver_name, reason: "No OneSignal ID" });
        continue;
      }

      const userStartHour = subscription.reminder_start_hour || 18;
      const userSkipWeekends = subscription.skip_weekends !== false;
      const userIntervalMinutes = subscription.reminder_interval_minutes || 30;

      console.log(`  ⚙️ Settings: start=${userStartHour}:00, interval=${userIntervalMinutes}min, skipWeekends=${userSkipWeekends}`);

      if (userSkipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
        console.log(`  ⏭️ Skipping (weekend disabled)`);
        skippedDrivers.push({ name: driver.driver_name, reason: "Weekend skipped" });
        continue;
      }

      if (currentHour < userStartHour) {
        console.log(`  ⏭️ Skipping (before start hour ${userStartHour})`);
        skippedDrivers.push({ name: driver.driver_name, reason: `Before ${userStartHour}:00` });
        continue;
      }

      if (subscription.last_reminder_date === today && subscription.last_reminder_sent_at) {
        const lastSentAt = new Date(subscription.last_reminder_sent_at);
        const minutesSinceLastReminder = Math.floor((now.getTime() - lastSentAt.getTime()) / (60 * 1000));

        console.log(`  📊 Last reminder: ${minutesSinceLastReminder} minutes ago`);

        if (minutesSinceLastReminder < userIntervalMinutes) {
          const waitMinutes = userIntervalMinutes - minutesSinceLastReminder;
          console.log(`  ⏭️ Skipping (interval not met, wait ${waitMinutes} more minutes)`);
          skippedDrivers.push({
            name: driver.driver_name,
            reason: `Wait ${waitMinutes}min`
          });
          continue;
        }
      }

      try {
        console.log(`  📤 Sending reminder to ${driver.driver_name}`);

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

        const responseData = await response.json();

        if (response.ok && responseData.id) {
          console.log(`  ✅ Reminder sent successfully (notification_id: ${responseData.id})`);

          await supabase
            .from("notification_subscriptions")
            .update({
              last_reminder_sent_at: now.toISOString(),
              last_reminder_date: today,
              updated_at: now.toISOString(),
            })
            .eq("id", subscription.id);

          await supabase.from("notification_reminders_log").insert({
            driver_id: driver.id,
            reminder_date: today,
            sent_at: now.toISOString(),
            reminder_type: "driver",
            message_content: `Reminder sent to ${driver.driver_name} at ${currentHour}:${String(currentMinute).padStart(2, '0')}`,
          });

          driverNotificationsSent++;
          remindedDrivers.push(driver.driver_name);
        } else {
          console.error(`  ❌ Failed to send reminder:`, responseData);
          skippedDrivers.push({
            name: driver.driver_name,
            reason: `OneSignal error: ${responseData.errors?.[0] || 'Unknown'}`
          });
        }
      } catch (error) {
        console.error(`  ❌ Exception sending reminder to ${driver.driver_name}:`, error);
        skippedDrivers.push({ name: driver.driver_name, reason: "Send failed" });
      }
    }

    if (driversNeedingReminder.length > 0 && currentHour >= 18) {
      console.log(`\n📊 Checking supervisor/admin notifications...`);

      const { data: supervisorSubscriptions } = await supabase
        .from("notification_subscriptions")
        .select("*")
        .in("role", ["supervisor", "admin"])
        .eq("enabled", true);

      if (supervisorSubscriptions && supervisorSubscriptions.length > 0) {
        console.log(`👔 Found ${supervisorSubscriptions.length} supervisor/admin subscriptions`);

        const driverNames = driversNeedingReminder
          .slice(0, 5)
          .map((d: Driver) => d.driver_name)
          .join("، ");

        const additionalCount = Math.max(0, driversNeedingReminder.length - 5);
        const summaryText = additionalCount > 0
          ? `${driverNames} و ${additionalCount} آخرين`
          : driverNames;

        for (const subscription of supervisorSubscriptions) {
          if (!subscription.onesignal_external_id) {
            console.log(`  ⚠️ No OneSignal ID for ${subscription.role}`);
            continue;
          }

          const userStartHour = subscription.reminder_start_hour || 18;
          const userIntervalMinutes = subscription.reminder_interval_minutes || 30;

          if (currentHour < userStartHour) {
            console.log(`  ⏭️ Skipping ${subscription.role} (before start hour)`);
            continue;
          }

          if (subscription.last_reminder_date === today && subscription.last_reminder_sent_at) {
            const lastSentAt = new Date(subscription.last_reminder_sent_at);
            const minutesSinceLastReminder = Math.floor((now.getTime() - lastSentAt.getTime()) / (60 * 1000));

            if (minutesSinceLastReminder < userIntervalMinutes) {
              console.log(`  ⏭️ Skipping ${subscription.role} (interval not met)`);
              continue;
            }
          }

          try {
            console.log(`  📤 Sending summary to ${subscription.role}`);

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

            const responseData = await response.json();

            if (response.ok && responseData.id) {
              console.log(`  ✅ Summary sent successfully to ${subscription.role}`);

              await supabase
                .from("notification_subscriptions")
                .update({
                  last_reminder_sent_at: now.toISOString(),
                  last_reminder_date: today,
                  updated_at: now.toISOString(),
                })
                .eq("id", subscription.id);

              await supabase.from("notification_reminders_log").insert({
                driver_id: null,
                reminder_date: today,
                sent_at: now.toISOString(),
                reminder_type: `${subscription.role}_summary`,
                message_content: `Summary sent to ${subscription.role}: ${driversNeedingReminder.length} drivers pending`,
              });
            } else {
              console.error(`  ❌ Failed to send summary to ${subscription.role}:`, responseData);
            }
          } catch (error) {
            console.error(`  ❌ Exception sending summary to ${subscription.role}:`, error);
          }
        }
      }
    }

    console.log(`\n✅ Function completed successfully`);
    console.log(`📊 Summary: ${driverNotificationsSent} reminders sent`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Reminders processing completed",
        date: today,
        time: now.toISOString(),
        hour: currentHour,
        minute: currentMinute,
        dayOfWeek,
        stats: {
          totalActiveDrivers: drivers.length,
          driversWithSubmissions: driversWithSubmissions.size,
          driversNeedingReminder: driversNeedingReminder.length,
          remindersSent: driverNotificationsSent,
          driversSkipped: skippedDrivers.length,
        },
        remindedDrivers,
        skippedDrivers,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("❌ Error in send-daily-reminders:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error",
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
