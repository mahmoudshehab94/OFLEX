# Automatic Reminder System - Complete Documentation

## System Status: FULLY OPERATIONAL ✅

The automatic reminder system is now **fully deployed and running**. Reminders are sent automatically every 10 minutes without any manual intervention required.

---

## How It Works

### 1. Cron Job (Automatic Scheduler)
- **Status**: ✅ ACTIVE
- **Job ID**: 1
- **Job Name**: `send_daily_work_reminders`
- **Schedule**: Every 10 minutes (`*/10 * * * *`)
- **Technology**: PostgreSQL pg_cron extension
- **Timezone**: UTC (but Edge Function handles local time conversion)

### 2. Edge Function
- **Function Name**: `send-daily-reminders`
- **URL**: `https://edeneqmxicfwmcbsxrxx.supabase.co/functions/v1/send-daily-reminders`
- **Deployment**: ✅ DEPLOYED
- **Purpose**: Evaluates each driver's settings and sends reminders when due

### 3. Database Tables
- **notification_subscriptions**: Stores driver notification preferences
- **notification_reminders_log**: Logs all sent reminders
- **work_entries**: Checked to see if driver submitted today
- **drivers**: List of active drivers

---

## Reminder Logic

### For Each Driver
The system evaluates these conditions **every 10 minutes**:

1. **Is driver active?** (`drivers.is_active = true`)
2. **Are reminders enabled?** (`notification_subscriptions.enabled = true`)
3. **Does driver have OneSignal ID?** (Required to send push notification)
4. **Has driver submitted today?** (Check `work_entries` for today's date)
5. **Is it past the start hour?** (Check against `reminder_start_hour`)
6. **Is it a weekend and weekends disabled?** (Check `skip_weekends`)
7. **Has enough time passed since last reminder?** (Check `reminder_interval_minutes`)

**If ALL conditions pass**: Send reminder via OneSignal

---

## Configuration Per Driver

Each driver can configure:

| Setting | Field | Default | Description |
|---------|-------|---------|-------------|
| Enable Reminders | `enabled` | `true` | Master on/off switch |
| Start Time | `reminder_start_hour` | `18` (6 PM) | Hour to start sending (0-23) |
| Interval | `reminder_interval_minutes` | `30` | Minutes between reminders (15-120) |
| Skip Weekends | `skip_weekends` | `true` | Don't send on Saturday/Sunday |

---

## Duplicate Prevention

### Mechanism 1: Interval Tracking
- `last_reminder_sent_at`: Records exact timestamp of last reminder
- `last_reminder_date`: Records the date for which reminder was sent
- System calculates time elapsed and only sends if interval has passed

### Mechanism 2: Daily Reset
- When a new day starts (date changes), `last_reminder_date` becomes outdated
- First reminder of new day is sent immediately (if after start hour)

### Mechanism 3: Submission Check
- Once driver submits work entry for today, no more reminders are sent
- System queries `work_entries` table for today's date
- Driver is removed from reminder list once submission exists

---

## Timezone Handling

### Server Time (UTC)
- Cron job runs on UTC timezone
- Edge Function receives UTC time from server

### Local Time Conversion
- Edge Function uses server's local time via `new Date()`
- `currentHour` is extracted: `now.getHours()`
- **Important**: The server runs in a specific timezone (likely UTC)
- Driver's `reminder_start_hour` is compared against this hour

### Current Behavior
If driver sets start time to 20:00 (8 PM):
- System checks: `currentHour >= 20`
- This uses **server timezone** (UTC)
- So 20:00 UTC = 8 PM UTC

### To Use Local Driver Timezone
Would require:
1. Storing each driver's timezone in database
2. Converting server time to driver's local time
3. Comparing against their local start hour

**Currently Not Implemented**: System uses server time only.

---

## What Happens When...

### Scenario 1: Driver submits after receiving one reminder
1. Driver receives reminder at 20:00
2. Driver submits work entry at 20:15
3. Next cron run at 20:20: System checks `work_entries` table
4. **Result**: No more reminders sent for that day

### Scenario 2: Multiple drivers, different settings
- Driver A: Start 18:00, Interval 30 min
- Driver B: Start 20:00, Interval 60 min
- At 20:00:
  - Driver A: Gets reminder (if 30+ min since last)
  - Driver B: Gets first reminder (just reached start time)

### Scenario 3: Weekend arrives
- Driver has `skip_weekends = true`
- Saturday 20:00: System checks day of week
- **Result**: No reminders sent on Sat/Sun

### Scenario 4: Driver disables reminders mid-day
- Driver received reminder at 18:00
- Driver disables at 18:30
- Next cron at 18:40: System checks `enabled` field
- **Result**: No more reminders sent

---

## Testing the System

### Method 1: Wait for Next Cron Run
- Cron runs every 10 minutes
- Check logs in Supabase Dashboard > Edge Functions > send-daily-reminders

### Method 2: Manual Trigger (Immediate)
Run this SQL query in Supabase SQL Editor:

```sql
SELECT trigger_reminders_now();
```

This calls the Edge Function immediately without waiting for cron.

### Method 3: Check Reminder Status
See which drivers are eligible for reminders:

```sql
SELECT * FROM driver_reminder_overview;
```

### Method 4: Check Reminder History
See all reminders that were sent:

```sql
SELECT
  driver_id,
  reminder_date,
  sent_at,
  message_content
FROM notification_reminders_log
WHERE reminder_date = CURRENT_DATE
ORDER BY sent_at DESC;
```

### Method 5: Verify Cron Job Status
Check if cron job is running:

```sql
SELECT
  jobid,
  jobname,
  schedule,
  active,
  nodename
FROM cron.job
WHERE jobname = 'send_daily_work_reminders';
```

Expected result:
- `active` should be `true`
- `schedule` should be `*/10 * * * *`

---

## How to Verify It's Working

### Step 1: Check a driver's settings
```sql
SELECT * FROM get_reminder_status();
```

Look for a driver with:
- `reminders_enabled = true`
- `has_onesignal_id = true`
- `submitted_today = false`
- Current hour >= `start_hour`

### Step 2: Trigger manually
```sql
SELECT trigger_reminders_now();
```

### Step 3: Check the logs
Go to Supabase Dashboard:
1. Functions > send-daily-reminders > Logs
2. Look for recent execution
3. Check for "Reminder sent successfully" messages

### Step 4: Verify database was updated
```sql
SELECT
  driver_name,
  last_reminder_sent_at,
  last_reminder_date
FROM driver_reminder_overview
WHERE reminders_enabled = true;
```

`last_reminder_sent_at` should have just been updated.

### Step 5: Check OneSignal
- Log into OneSignal dashboard
- Go to Messages > Sent
- Verify notification was delivered

---

## Troubleshooting

### Reminders Not Sending

**Check 1: Is cron active?**
```sql
SELECT * FROM cron.job WHERE jobname = 'send_daily_work_reminders';
```
If not found or `active = false`, re-run the migration.

**Check 2: Are OneSignal credentials configured?**
- Check Supabase Dashboard > Edge Functions > Secrets
- `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY` must be set

**Check 3: Does driver have OneSignal ID?**
```sql
SELECT * FROM get_reminder_status();
```
Check `has_onesignal_id` column. If false, driver needs to enable notifications in app.

**Check 4: Is it before start hour?**
Check current server time and driver's `start_hour`.

**Check 5: Did driver already submit?**
```sql
SELECT * FROM get_reminder_status();
```
Check `submitted_today` column.

**Check 6: Check Edge Function logs**
Supabase Dashboard > Functions > send-daily-reminders > Logs
Look for errors or skip messages.

### Duplicate Reminders Being Sent

**Check interval tracking:**
```sql
SELECT
  driver_name,
  last_reminder_sent_at,
  NOW() - last_reminder_sent_at as time_since_last,
  interval_minutes
FROM driver_reminder_overview
WHERE reminders_enabled = true;
```

If `time_since_last` is less than `interval_minutes`, but reminders are still being sent, there's a bug in the Edge Function logic.

### Wrong Time Being Used

The system uses **server UTC time** by default.

To verify:
1. Check Edge Function logs for timestamp
2. Compare with your local time
3. Adjust driver's `reminder_start_hour` accordingly

Example:
- Your local time: 8 PM (UTC+2 = 18:00 UTC)
- Set `reminder_start_hour = 18` (not 20)

---

## Database Schema

### notification_subscriptions
```sql
- id (uuid, primary key)
- user_account_id (uuid, unique)
- driver_id (uuid, nullable)
- enabled (boolean, default true)
- reminder_start_hour (integer, 0-23, default 18)
- reminder_interval_minutes (integer, 15-120, default 30)
- skip_weekends (boolean, default true)
- last_reminder_sent_at (timestamptz, nullable)
- last_reminder_date (date, nullable)
- onesignal_player_id (text, nullable)
- onesignal_external_id (text, nullable)
- created_at (timestamptz)
- updated_at (timestamptz)
```

### notification_reminders_log
```sql
- id (uuid, primary key)
- driver_id (uuid, nullable)
- reminder_date (date, default CURRENT_DATE)
- sent_at (timestamptz, default now())
- reminder_type (text: 'driver', 'supervisor_summary', 'admin_summary')
- message_content (text, nullable)
- created_at (timestamptz)
```

---

## System Maintenance

### View Cron Job History
```sql
SELECT * FROM cron.job_run_details
WHERE jobid = 1
ORDER BY start_time DESC
LIMIT 20;
```

### Disable Reminders Globally (Emergency Stop)
```sql
SELECT cron.unschedule('send_daily_work_reminders');
```

### Re-enable Reminders
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

### Clear Reminder History (Cleanup)
```sql
DELETE FROM notification_reminders_log
WHERE reminder_date < CURRENT_DATE - INTERVAL '30 days';
```

---

## Performance Considerations

### Current Load
- Cron runs every 10 minutes = 144 times per day
- Each run: 1 Edge Function call
- Edge Function: Queries all active drivers, checks work entries
- Cost: Minimal (< 1000 function invocations/day)

### Scaling
If you have 100+ drivers:
- Consider increasing cron interval to 15 or 20 minutes
- Add database indexes on frequently queried columns
- Monitor Edge Function execution time

### Recommended Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_work_entries_driver_date
ON work_entries(driver_id, date);

CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_driver
ON notification_subscriptions(driver_id, enabled);

CREATE INDEX IF NOT EXISTS idx_reminders_log_driver_date
ON notification_reminders_log(driver_id, reminder_date);
```

---

## Security

### Edge Function
- Uses ANON_KEY (public key) - safe for cron job
- No sensitive data exposed in URL
- CORS headers configured properly

### Cron Job
- Runs within Supabase infrastructure
- Credentials stored in database securely
- No external services required

### Database Functions
- `trigger_reminders_now()`: Restricted to authenticated users
- `get_reminder_status()`: Restricted to authenticated users
- Uses `SECURITY DEFINER` to execute with proper permissions

---

## Summary

✅ **Cron Job**: Created and active, runs every 10 minutes
✅ **Edge Function**: Deployed and working
✅ **Database**: Schema complete with tracking fields
✅ **Test Functions**: Available for immediate testing
✅ **Duplicate Prevention**: Implemented via interval tracking
✅ **Submission Detection**: Driver removed from list after submitting
✅ **Individual Settings**: Each driver has custom preferences

**The system is fully automatic and operational.**

No manual intervention required. Reminders will be sent automatically based on each driver's preferences.
