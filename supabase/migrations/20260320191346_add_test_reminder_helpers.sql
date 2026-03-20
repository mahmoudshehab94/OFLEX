/*
  # Add Test Helper Functions for Reminder System

  ## Purpose
  Create utility functions to help test and verify the reminder system
  without waiting for scheduled cron execution.

  ## Changes
  
  1. Create Function: trigger_reminders_now()
     - Manually triggers the reminder Edge Function immediately
     - Returns the response from the Edge Function
     - Useful for testing without waiting for cron
  
  2. Create Function: get_reminder_status()
     - Shows the current status of all driver reminder settings
     - Shows when last reminder was sent
     - Shows whether driver has submitted today
  
  3. Create View: driver_reminder_overview
     - Easy-to-read overview of reminder system status
     - Shows all drivers with their notification settings

  ## Security
  - Functions are restricted to authenticated users only
*/

-- Function to manually trigger reminders (for testing)
CREATE OR REPLACE FUNCTION trigger_reminders_now()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT INTO result
    net.http_post(
      url := 'https://edeneqmxicfwmcbsxrxx.supabase.co/functions/v1/send-daily-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkZW5lcW14aWNmd21jYnN4cnh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMDkyMTAsImV4cCI6MjA4NDU4NTIxMH0.zwcZ4ajrGKzRPyz--m7FjQc8n5VXmeCrCbH-y02U628'
      ),
      body := '{}'::jsonb
    ) AS response;
  
  RETURN result;
END;
$$;

-- Function to get reminder status for all drivers
CREATE OR REPLACE FUNCTION get_reminder_status()
RETURNS TABLE (
  driver_id uuid,
  driver_name text,
  is_active boolean,
  reminders_enabled boolean,
  start_hour integer,
  interval_minutes integer,
  skip_weekends boolean,
  last_reminder_sent_at timestamptz,
  last_reminder_date date,
  submitted_today boolean,
  has_onesignal_id boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    d.id as driver_id,
    d.driver_name,
    d.is_active,
    COALESCE(ns.enabled, false) as reminders_enabled,
    COALESCE(ns.reminder_start_hour, 18) as start_hour,
    COALESCE(ns.reminder_interval_minutes, 30) as interval_minutes,
    COALESCE(ns.skip_weekends, true) as skip_weekends,
    ns.last_reminder_sent_at,
    ns.last_reminder_date,
    EXISTS(
      SELECT 1 FROM work_entries we 
      WHERE we.driver_id = d.id 
      AND we.date = CURRENT_DATE
    ) as submitted_today,
    (ns.onesignal_external_id IS NOT NULL) as has_onesignal_id
  FROM drivers d
  LEFT JOIN notification_subscriptions ns ON ns.driver_id = d.id
  WHERE d.is_active = true
  ORDER BY d.driver_name;
$$;

-- Create a view for easy monitoring
CREATE OR REPLACE VIEW driver_reminder_overview AS
SELECT 
  d.driver_name,
  d.is_active,
  COALESCE(ns.enabled, false) as reminders_enabled,
  COALESCE(ns.reminder_start_hour, 18) as start_hour,
  COALESCE(ns.reminder_interval_minutes, 30) as interval_minutes,
  COALESCE(ns.skip_weekends, true) as skip_weekends,
  ns.last_reminder_sent_at,
  ns.last_reminder_date,
  EXISTS(
    SELECT 1 FROM work_entries we 
    WHERE we.driver_id = d.id 
    AND we.date = CURRENT_DATE
  ) as submitted_today,
  (ns.onesignal_external_id IS NOT NULL) as has_onesignal_id,
  CASE 
    WHEN NOT d.is_active THEN 'Driver Inactive'
    WHEN NOT COALESCE(ns.enabled, false) THEN 'Reminders Disabled'
    WHEN ns.onesignal_external_id IS NULL THEN 'No OneSignal ID'
    WHEN EXISTS(SELECT 1 FROM work_entries we WHERE we.driver_id = d.id AND we.date = CURRENT_DATE) 
      THEN 'Already Submitted Today'
    ELSE 'Eligible for Reminders'
  END as status
FROM drivers d
LEFT JOIN notification_subscriptions ns ON ns.driver_id = d.id
ORDER BY d.driver_name;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION trigger_reminders_now() TO authenticated;
GRANT EXECUTE ON FUNCTION get_reminder_status() TO authenticated;
GRANT SELECT ON driver_reminder_overview TO authenticated;

COMMENT ON FUNCTION trigger_reminders_now() IS 'Manually trigger the reminder system immediately for testing';
COMMENT ON FUNCTION get_reminder_status() IS 'Get detailed reminder status for all drivers';
COMMENT ON VIEW driver_reminder_overview IS 'Overview of driver reminder system status';
