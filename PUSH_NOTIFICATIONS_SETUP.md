# Push Notifications System - Trans Oflex

## Overview

This document explains the complete push notification reminder system implemented for Trans Oflex using OneSignal and Supabase.

## Features

### 1. Driver Reminders
- Drivers who haven't submitted their work entries receive reminders after 18:00 (6 PM)
- Reminders repeat every 30 minutes until submission
- Automatic stop once the driver submits their work entry

### 2. Supervisor/Admin Summaries
- Supervisors and admins receive daily summaries of drivers who haven't submitted
- Summaries list up to 5 driver names with count of additional drivers
- Also repeat every 30 minutes

### 3. User Control
- Users can enable/disable notifications from their profile
- Clear UI feedback for subscription status
- Proper permission handling

## System Architecture

### Database Tables

#### `notification_subscriptions`
Stores user notification preferences and OneSignal subscription data:
- `user_account_id`: Links to user account
- `onesignal_player_id`: OneSignal device subscription ID
- `onesignal_external_id`: External user ID for OneSignal (format: `user_{user_account_id}`)
- `enabled`: Whether notifications are enabled
- `role`: User role (driver, supervisor, admin)
- `driver_id`: Linked driver ID (only for drivers)

#### `notification_reminders_log`
Tracks sent reminders to prevent duplicates:
- `driver_id`: Driver who received reminder (null for summaries)
- `reminder_date`: Date of the reminder
- `sent_at`: Timestamp when sent
- `reminder_type`: Type (driver, supervisor_summary, admin_summary)
- `message_content`: Content of the reminder

### Frontend Integration

#### OneSignal Service (`src/lib/onesignal.ts`)
- Initializes OneSignal SDK
- Handles permission requests
- Manages subscriptions (subscribe/unsubscribe)
- Links OneSignal subscriptions to user accounts in database

#### Notification Settings UI (`src/components/NotificationSettings.tsx`)
- Displayed in Driver and Supervisor profiles
- Toggle to enable/disable notifications
- Shows subscription status
- Provides user feedback

### Backend - Edge Function

#### `send-daily-reminders` Edge Function
Scheduled function that:

1. **Runs after 18:00 only**
   - Checks current time and exits early if before 6 PM

2. **Finds drivers needing reminders**
   - Gets all active drivers
   - Checks which ones have NOT submitted work entries for today
   - Excludes drivers who were reminded in the last 30 minutes

3. **Sends driver reminders**
   - For each driver without submission
   - Sends push notification via OneSignal API
   - Logs reminder in `notification_reminders_log`

4. **Sends supervisor/admin summaries**
   - Finds all subscribed supervisors and admins
   - Sends summary with count and driver names
   - Also respects 30-minute cooldown

## How Reminders Stop After Submission

When a driver submits their work entry:
1. A new row is inserted into `work_entries` table with today's date
2. The Edge Function queries `work_entries` for today's date
3. If an entry exists for a driver, they are excluded from reminders
4. No additional code needed - it's automatic based on data presence

## Scheduling the Edge Function

The Edge Function should be triggered every 30 minutes using one of these methods:

### Option 1: External Cron Service (Recommended)
Use a service like:
- **Cron-job.org**
- **EasyCron**
- **GitHub Actions**

Configure it to call:
```
POST https://your-project.supabase.co/functions/v1/send-daily-reminders
Header: Authorization: Bearer YOUR_SUPABASE_ANON_KEY
```

Schedule: Every 30 minutes between 18:00 and 23:30

### Option 2: Supabase pg_cron (Advanced)
If you have Supabase Pro plan, use pg_cron to trigger the function:

```sql
SELECT cron.schedule(
  'send-daily-reminders-every-30min',
  '*/30 18-23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/send-daily-reminders',
    headers := '{"Authorization": "Bearer YOUR_SUPABASE_ANON_KEY"}'::jsonb
  );
  $$
);
```

## Environment Variables

### Frontend (.env)
```env
VITE_ONESIGNAL_APP_ID=your_onesignal_app_id
```

### Edge Function Secrets
Set these in Supabase Dashboard under Edge Functions → Secrets:
```
ONESIGNAL_APP_ID=your_onesignal_app_id
ONESIGNAL_REST_API_KEY=your_onesignal_rest_api_key
```

Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically provided by Supabase.

## OneSignal Setup

### 1. Create OneSignal Account
- Go to https://onesignal.com
- Create a new app
- Choose "Web Push" platform

### 2. Configure Web Push
- Add your site URL
- Upload service worker files to your public root:
  - `OneSignalSDKWorker.js`
  - `OneSignalSDKUpdaterWorker.js`

### 3. Get API Keys
- **App ID**: Found in Settings → Keys & IDs
- **REST API Key**: Found in Settings → Keys & IDs

### 4. Configure Allowed Origins
- Add your production domain
- Add localhost for development (if needed)

## Testing

### Test Driver Reminder Flow
1. Create a driver account and log in
2. Enable notifications in profile
3. Do NOT submit work entry for today
4. Manually trigger the Edge Function (or wait until after 18:00)
5. Check that notification is received
6. Submit work entry
7. Trigger function again - no notification should be sent

### Test Supervisor Summary
1. Create supervisor account and log in
2. Enable notifications in profile
3. Ensure at least one driver hasn't submitted
4. Manually trigger the Edge Function
5. Check that summary notification is received with driver list

### Manual Trigger (for testing)
```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-daily-reminders \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json"
```

## Security

### RLS Policies
- Users can only view/modify their own subscriptions
- Admins can view all subscriptions
- Reminder logs are read-only for supervisors/admins
- Edge Function uses service role to bypass RLS for sending

### API Keys
- OneSignal REST API Key is ONLY used server-side in Edge Function
- Never exposed to frontend
- Stored securely in Supabase Edge Function secrets

## Troubleshooting

### Notifications not received
1. Check browser notification permissions
2. Verify OneSignal App ID is correct in .env
3. Check that user has enabled notifications in profile
4. Verify OneSignal service workers are accessible at root URL
5. Check Edge Function logs for errors

### Reminders sent too frequently
- Check `notification_reminders_log` for duplicate entries
- Verify 30-minute cooldown logic is working
- Check server time zone configuration

### Drivers still receiving reminders after submission
- Verify work entry was saved with correct date format (YYYY-MM-DD)
- Check `work_entries` table for today's date
- Verify Edge Function is querying with correct date

## Maintenance

### Monitor Reminder Logs
```sql
SELECT
  reminder_type,
  reminder_date,
  COUNT(*) as count,
  MAX(sent_at) as last_sent
FROM notification_reminders_log
WHERE reminder_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY reminder_type, reminder_date
ORDER BY reminder_date DESC, reminder_type;
```

### Check Active Subscriptions
```sql
SELECT
  role,
  COUNT(*) as active_subscriptions
FROM notification_subscriptions
WHERE enabled = true
GROUP BY role;
```

### Clean Old Logs (optional, run monthly)
```sql
DELETE FROM notification_reminders_log
WHERE reminder_date < CURRENT_DATE - INTERVAL '90 days';
```

## Future Enhancements

Possible improvements:
- Customizable reminder times per user
- Different reminder frequencies (15 min, 1 hour, etc.)
- SMS fallback for critical reminders
- Push notification action buttons (e.g., "Submit Now")
- Reminder preview/test in UI
- Analytics dashboard for notification delivery
