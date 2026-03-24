/*
  # Add Reminder Tracking Fields to notification_subscriptions

  ## Purpose
  Enable automatic reminder system to track when reminders were last sent
  to prevent duplicate notifications and properly space out reminder intervals.

  ## Changes
  
  1. New Columns Added to `notification_subscriptions`
     - `last_reminder_sent_at` (timestamptz, nullable)
       - Stores the exact timestamp when the last reminder was sent
       - Used to calculate if enough time has passed for next reminder
     
     - `last_reminder_date` (date, nullable)
       - Stores the date for which the last reminder was sent
       - Resets each day so reminders start fresh
       - Prevents sending reminders after driver submits for that day

  ## Notes
  - These fields are nullable because existing subscriptions won't have history
  - The reminder cron job will update these fields automatically
  - When a driver submits work hours, the system can check this date
*/

-- Add tracking fields for reminder system
DO $$
BEGIN
  -- Add last_reminder_sent_at if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_subscriptions' 
    AND column_name = 'last_reminder_sent_at'
  ) THEN
    ALTER TABLE notification_subscriptions 
    ADD COLUMN last_reminder_sent_at timestamptz;
    
    COMMENT ON COLUMN notification_subscriptions.last_reminder_sent_at IS 
    'Timestamp when the last reminder was sent - used to calculate reminder intervals';
  END IF;

  -- Add last_reminder_date if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_subscriptions' 
    AND column_name = 'last_reminder_date'
  ) THEN
    ALTER TABLE notification_subscriptions 
    ADD COLUMN last_reminder_date date;
    
    COMMENT ON COLUMN notification_subscriptions.last_reminder_date IS 
    'Date for which the last reminder was sent - resets daily, stops when driver submits';
  END IF;
END $$;
