/*
  # Add Advanced Notification Preferences

  1. Changes to notification_subscriptions
    - Add reminder_start_hour (integer, default 18) - hour to start sending reminders
    - Add reminder_interval_minutes (integer, default 30) - minutes between reminders
    - Add skip_weekends (boolean, default true) - skip Saturday and Sunday

  2. No breaking changes
    - All columns have safe defaults
    - Existing data will work without modifications
*/

-- Add new columns for notification preferences
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_subscriptions' AND column_name = 'reminder_start_hour'
  ) THEN
    ALTER TABLE notification_subscriptions ADD COLUMN reminder_start_hour integer DEFAULT 18 CHECK (reminder_start_hour >= 0 AND reminder_start_hour <= 23);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_subscriptions' AND column_name = 'reminder_interval_minutes'
  ) THEN
    ALTER TABLE notification_subscriptions ADD COLUMN reminder_interval_minutes integer DEFAULT 30 CHECK (reminder_interval_minutes >= 15 AND reminder_interval_minutes <= 120);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_subscriptions' AND column_name = 'skip_weekends'
  ) THEN
    ALTER TABLE notification_subscriptions ADD COLUMN skip_weekends boolean DEFAULT true;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN notification_subscriptions.reminder_start_hour IS 'Hour (0-23) to start sending reminders, default 18 (6 PM)';
COMMENT ON COLUMN notification_subscriptions.reminder_interval_minutes IS 'Minutes between reminders (15-120), default 30';
COMMENT ON COLUMN notification_subscriptions.skip_weekends IS 'Skip Saturday and Sunday, default true';
