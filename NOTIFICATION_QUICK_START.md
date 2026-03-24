# Push Notifications - Quick Start Guide

## 🚀 What Was Implemented

A complete push notification system for Trans Oflex that:
- Sends reminders to drivers after 18:00 if they haven't submitted work entries
- Repeats every 30 minutes until they submit
- Sends summaries to supervisors/admins listing pending drivers
- Stops automatically when driver submits their entry

## ✅ What's Done

### Database
- ✅ `notification_subscriptions` table created
- ✅ `notification_reminders_log` table created
- ✅ RLS policies configured
- ✅ Indexes added for performance

### Frontend
- ✅ OneSignal SDK integration (`src/lib/onesignal.ts`)
- ✅ Notification settings UI (`src/components/NotificationSettings.tsx`)
- ✅ Added to Driver profile (new tab: "Benachrichtigungen")
- ✅ Added to Supervisor profile (bottom section)

### Backend
- ✅ Edge Function `send-daily-reminders` deployed
- ✅ Driver reminder logic implemented
- ✅ Supervisor/admin summary logic implemented
- ✅ 30-minute cooldown to prevent spam
- ✅ Automatic stop when work entry submitted

### Build
- ✅ Project builds successfully
- ✅ All TypeScript types correct
- ✅ No breaking changes to existing features

## 📋 What You Need to Do

### 1. Upload OneSignal Service Workers

Upload these files to your public root (same level as index.html):
- `OneSignalSDKWorker.js`
- `OneSignalSDKUpdaterWorker.js`

(You mentioned you'll handle this manually - that's perfect!)

### 2. Set Up OneSignal Account

1. Go to https://onesignal.com
2. Create account and new Web Push app
3. Get your **App ID** and **REST API Key** from Settings → Keys & IDs
4. Add your production domain to allowed origins

### 3. Configure Environment Variables

**In your .env file:**
```env
VITE_ONESIGNAL_APP_ID=your_actual_app_id_here
```

**In Supabase Dashboard (Edge Functions → Secrets):**
```
ONESIGNAL_APP_ID=your_actual_app_id_here
ONESIGNAL_REST_API_KEY=your_actual_rest_api_key_here
```

### 4. Set Up Cron Job

The Edge Function needs to run every 30 minutes.

**Option A: Use Cron-job.org (Easiest)**
1. Go to https://cron-job.org
2. Create free account
3. Add new cron job:
   - **URL**: `https://your-project.supabase.co/functions/v1/send-daily-reminders`
   - **Method**: POST
   - **Headers**: Add `Authorization: Bearer YOUR_SUPABASE_ANON_KEY`
   - **Schedule**: Every 30 minutes (or custom: `*/30 18-23 * * *` for 6PM-11:30PM only)

**Option B: GitHub Actions**
Create `.github/workflows/notifications.yml`:
```yaml
name: Send Notifications
on:
  schedule:
    - cron: '*/30 18-23 * * *'
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Edge Function
        run: |
          curl -X POST https://your-project.supabase.co/functions/v1/send-daily-reminders \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
```

## 🧪 Testing

### Quick Test (Manual Trigger)
```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-daily-reminders \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Test Flow
1. Login as driver
2. Go to profile → "Benachrichtigungen" tab
3. Click "تفعيل الإشعارات" and allow notifications
4. Don't submit work entry for today
5. Trigger function manually (above command)
6. You should receive a push notification
7. Submit work entry
8. Trigger again - no notification (stopped automatically!)

## 📊 How It Works

### User Subscribes
1. User clicks "Enable Notifications" in profile
2. Browser requests permission
3. OneSignal creates subscription
4. Subscription saved to database with external ID: `user_{user_account_id}`

### Every 30 Minutes (After 18:00)
1. Edge Function wakes up
2. Checks current time (only runs after 18:00)
3. Finds drivers without today's work entry
4. Excludes drivers reminded in last 30 minutes
5. Sends push notification to each pending driver
6. Logs reminder in database
7. Sends summary to supervisors/admins

### Reminder Stops
- When driver submits work entry
- Entry is saved to `work_entries` table
- Next time function runs, it finds the entry
- Driver is excluded from reminder list
- **No additional code needed - automatic!**

## 🔍 Database Queries

### Check who has notifications enabled
```sql
SELECT ua.username, ns.role, ns.enabled
FROM notification_subscriptions ns
JOIN user_accounts ua ON ua.id = ns.user_account_id
WHERE ns.enabled = true;
```

### Check recent reminders sent
```sql
SELECT
  r.reminder_type,
  r.reminder_date,
  COUNT(*) as count,
  MAX(r.sent_at) as last_sent
FROM notification_reminders_log r
WHERE r.reminder_date >= CURRENT_DATE - 7
GROUP BY r.reminder_type, r.reminder_date
ORDER BY r.reminder_date DESC;
```

### Check drivers pending today
```sql
SELECT d.driver_name, d.driver_code
FROM drivers d
WHERE d.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM work_entries we
  WHERE we.driver_id = d.id
  AND we.work_date = CURRENT_DATE
);
```

## 📚 Full Documentation

For complete details, see:
- **`NOTIFICATION_SYSTEM_IMPLEMENTATION.md`** - Complete implementation details
- **`PUSH_NOTIFICATIONS_SETUP.md`** - Detailed setup and troubleshooting

## ✨ Summary

Everything is ready! Just:
1. Upload OneSignal service workers
2. Add environment variables
3. Set up cron job
4. Test!

The system is **production-ready** and fully integrated with your existing app without breaking any current features.
