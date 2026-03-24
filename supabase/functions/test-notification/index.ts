import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID") || "";
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY") || "";

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
    console.log("🧪 Testing OneSignal notification");

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.error("❌ OneSignal credentials not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "OneSignal not configured",
          env: {
            hasAppId: !!ONESIGNAL_APP_ID,
            hasApiKey: !!ONESIGNAL_REST_API_KEY,
          },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const { external_id, title, message } = body;

    if (!external_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "external_id is required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Environment check:");
    console.log("ONESIGNAL_APP_ID:", ONESIGNAL_APP_ID);
    console.log("ONESIGNAL_APP_ID length:", ONESIGNAL_APP_ID.length);
    console.log("ONESIGNAL_REST_API_KEY length:", ONESIGNAL_REST_API_KEY.length);

    const notificationMessage = {
      app_id: ONESIGNAL_APP_ID,
      include_external_user_ids: [external_id],
      headings: { en: title || "Test Alert" },
      contents: {
        en: message || "This is a test notification",
      },
      data: {
        type: "test_notification",
        timestamp: new Date().toISOString(),
      },
    };

    console.log("📤 Sending test notification to:", external_id);
    console.log("Message:", JSON.stringify(notificationMessage));

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(notificationMessage),
    });

    const responseData = await response.json();

    console.log("OneSignal response:", responseData);

    if (response.ok && responseData.id) {
      console.log(`✅ Test notification sent successfully (id: ${responseData.id})`);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Test notification sent successfully",
          notification_id: responseData.id,
          recipients: responseData.recipients,
          external_id,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      console.error("❌ Failed to send notification:", responseData);

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to send notification",
          details: responseData,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error: any) {
    console.error("❌ Error in test-notification:", error);
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
