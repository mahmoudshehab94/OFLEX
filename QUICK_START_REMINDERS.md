# Quick Start: Testing the Reminder System

## System Status ✅

**The automatic reminder system is FULLY OPERATIONAL and running.**

- Cron Job: Active (runs every 10 minutes)
- Edge Function: Deployed
- Database: Configured
- Test Functions: Available

---

## Verify System (30 seconds)

Copy and paste this into Supabase SQL Editor:

```sql
SELECT
  'Cron Job' as component,
  CASE WHEN active THEN '✅ Running' ELSE '❌ Stopped' END as status,
  schedule as details
FROM cron.job
WHERE jobname = 'send_daily_work_reminders'

UNION ALL

SELECT
  'Drivers Ready' as component,
  '✅ ' || COUNT(*) || ' driver(s)' as status,
  'Enabled: ' || SUM(CASE WHEN ns.enabled THEN 1 ELSE 0 END) || ', Has OneSignal: ' || SUM(CASE WHEN ns.onesignal_external_id IS NOT NULL THEN 1 ELSE 0 END) as details
FROM drivers d
LEFT JOIN notification_subscriptions ns ON ns.driver_id = d.id
WHERE d.is_active = true;
```

Expected Output:
- Cron Job: ✅ Running, */10 * * * *
- Drivers Ready: ✅ X driver(s)

---

## Test Immediately (No Waiting)

Run this SQL command to trigger reminders NOW:

```sql
SELECT trigger_reminders_now();
```

This bypasses the cron schedule and executes the Edge Function immediately.

---

## View Driver Status

```sql
SELECT * FROM driver_reminder_overview;
```

This shows each driver's:
- Reminder enabled/disabled
- Start hour
- Interval minutes
- Weekend settings
- Last reminder time
- Submission status
- Eligibility status

---

## Check If It Worked

After running `trigger_reminders_now()`, check if reminders were sent:

```sql
SELECT
  d.driver_name,
  nrl.sent_at,
  nrl.message_content
FROM notification_reminders_log nrl
JOIN drivers d ON d.id = nrl.driver_id
WHERE nrl.reminder_date = CURRENT_DATE
ORDER BY nrl.sent_at DESC
LIMIT 10;
```

If reminders were sent, you'll see entries here.

---

## Why No Reminders Might Be Sent

Check the driver status view to see why:

```sql
SELECT
  driver_name,
  status,
  reminders_enabled,
  has_onesignal_id,
  submitted_today
FROM driver_reminder_overview
WHERE is_active = true;
```

Common reasons:
- **"Driver Inactive"**: Driver is deactivated
- **"Reminders Disabled"**: Driver turned off notifications
- **"No OneSignal ID"**: Driver hasn't enabled push notifications in app
- **"Already Submitted Today"**: Driver already logged work hours
- **"Before start hour"**: Current time is before driver's start time

---

## Viewing Cron Job Logs

Check when the cron last ran:

```sql
SELECT
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = 1
ORDER BY start_time DESC
LIMIT 10;
```

This shows the execution history of the cron job.

---

## Edge Function Logs

1. Go to Supabase Dashboard
2. Navigate to: **Edge Functions** > **send-daily-reminders**
3. Click **Logs** tab
4. View real-time execution logs

Look for:
- "🚀 Starting send-daily-reminders function"
- "👥 Found X active drivers"
- "📤 Sending reminder to [driver name]"
- "✅ Reminder sent successfully"

---

## Test with a Real Driver

### Prerequisites
1. Driver must be active
2. Driver must have notification subscription with `enabled = true`
3. Driver must have OneSignal external ID set
4. Driver must NOT have submitted work entry for today
5. Current hour must be >= driver's `reminder_start_hour`

### Setup Test Driver

```sql
-- Enable reminders for a specific driver
UPDATE notification_subscriptions
SET
  enabled = true,
  reminder_start_hour = EXTRACT(HOUR FROM NOW())::integer, -- Current hour
  reminder_interval_minutes = 30,
  skip_weekends = false, -- Allow all days for testing
  last_reminder_sent_at = NULL, -- Reset
  last_reminder_date = NULL -- Reset
WHERE driver_id = (
  SELECT id FROM drivers WHERE driver_name = 'mahmoud' LIMIT 1
);

-- Verify it worked
SELECT * FROM get_reminder_status()
WHERE driver_name = 'mahmoud';
```

### Trigger Test

```sql
SELECT trigger_reminders_now();
```

### Verify Reminder Was Sent

```sql
SELECT
  d.driver_name,
  nrl.sent_at,
  nrl.message_content,
  ns.last_reminder_sent_at,
  ns.last_reminder_date
FROM drivers d
JOIN notification_subscriptions ns ON ns.driver_id = d.id
LEFT JOIN notification_reminders_log nrl ON nrl.driver_id = d.id
  AND nrl.reminder_date = CURRENT_DATE
WHERE d.driver_name = 'mahmoud'
ORDER BY nrl.sent_at DESC
LIMIT 1;
```

If successful:
- `sent_at` will have a timestamp
- `last_reminder_sent_at` will be updated
- `last_reminder_date` will be today's date

---

## Understanding Timezone

The system uses **UTC server time**.

### Current Server Time

```sql
SELECT
  NOW() as server_time_utc,
  EXTRACT(HOUR FROM NOW()) as current_hour_utc,
  CURRENT_DATE as current_date_utc;
```

### What This Means

If you set `reminder_start_hour = 18`:
- Reminders start at 18:00 UTC
- NOT 18:00 local time

**Example**:
- Your local time: 8:00 PM (Cairo Time = UTC+2)
- Cairo 8:00 PM = 6:00 PM UTC = 18:00 UTC
- Set `reminder_start_hour = 18` to get reminders at 8 PM Cairo time

---

## Emergency Controls

### Stop All Reminders

```sql
SELECT cron.unschedule('send_daily_work_reminders');
```

### Restart Reminders

```sql
SELECT cron.schedule(
  'send_daily_work_reminders',
  '*/10 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://edeneqmxicfwmcbsxrxx.supabase.co/functions/v1/send-daily-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkZW5lcW14aWNmd21jYnN4cnh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMDkyMTAsImV4cCI6MjA4NDU4NTIxMH0.zwcZ4ajrGKzRPyz--m7FjQc8n5VXmeCrCbH-y02U628'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

### Disable Reminders for Specific Driver

```sql
UPDATE notification_subscriptions
SET enabled = false
WHERE driver_id = (SELECT id FROM drivers WHERE driver_name = 'driver_name_here');
```

---

## Common Issues

### Issue: "No reminders being sent"

**Check 1**: Is cron running?
```sql
SELECT active FROM cron.job WHERE jobname = 'send_daily_work_reminders';
```
Expected: `true`

**Check 2**: Are OneSignal credentials configured?
- Supabase Dashboard > Edge Functions > Secrets
- Must have: `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY`

**Check 3**: Do drivers have OneSignal IDs?
```sql
SELECT driver_name, has_onesignal_id
FROM driver_reminder_overview;
```

**Check 4**: Check Edge Function logs for errors
- Dashboard > Edge Functions > send-daily-reminders > Logs

### Issue: "Reminders sent too frequently"

Check the driver's interval setting:
```sql
SELECT
  driver_name,
  reminder_interval_minutes,
  last_reminder_sent_at,
  NOW() - last_reminder_sent_at as time_since_last
FROM driver_reminder_overview
WHERE reminders_enabled = true;
```

### Issue: "Reminders sent after submission"

This shouldn't happen. Verify:
```sql
SELECT
  d.driver_name,
  we.date as submission_date,
  nrl.sent_at as reminder_sent,
  CASE
    WHEN nrl.sent_at > we.created_at THEN '⚠️ SENT AFTER SUBMISSION'
    ELSE '✅ OK'
  END as check_result
FROM notification_reminders_log nrl
JOIN drivers d ON d.id = nrl.driver_id
LEFT JOIN work_entries we ON we.driver_id = d.id
  AND we.date = nrl.reminder_date
WHERE nrl.reminder_date = CURRENT_DATE
ORDER BY nrl.sent_at DESC;
```

---

## Summary

**The system is fully automatic and operational.**

To test right now:
1. Run: `SELECT trigger_reminders_now();`
2. Check: `SELECT * FROM driver_reminder_overview;`
3. Verify: Check Edge Function logs

**No further setup required.**

The cron job will continue running every 10 minutes automatically.

For detailed documentation, see: `AUTOMATIC_REMINDER_SYSTEM.md`
