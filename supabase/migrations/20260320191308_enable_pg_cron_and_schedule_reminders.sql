/*
  # Enable pg_cron and Schedule Automatic Reminders

  ## Purpose
  Enable the pg_cron extension and create a scheduled job to automatically
  send reminders every 10 minutes throughout the day.

  ## Changes
  
  1. Enable pg_cron Extension
     - Installs the pg_cron extension for scheduled job execution
  
  2. Enable pg_net Extension
     - Required for making HTTP requests from database
  
  3. Create Scheduled Job
     - Job Name: send_daily_work_reminders
     - Schedule: Every 10 minutes
     - Action: Call the send-daily-reminders Edge Function via HTTP
     - Timezone: UTC (server time)

  ## How It Works
  - The cron job runs every 10 minutes
  - It calls the Edge Function which checks each driver's individual settings
  - The Edge Function respects each driver's start time and interval
  - Reminders are only sent when due based on individual driver preferences

  ## Notes
  - pg_cron uses UTC timezone
  - The Edge Function handles local time logic internally
  - The job will run 24/7, but the Edge Function respects time windows
*/

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Remove any existing reminder job to avoid duplicates
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname = 'send_daily_work_reminders';

-- Create the scheduled job to run every 10 minutes
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

-- Verify the job was created
SELECT jobid, jobname, schedule, active, nodename
FROM cron.job
WHERE jobname = 'send_daily_work_reminders';
