/*
  # Create Push Notification Subscription System

  1. New Tables
    - `notification_subscriptions`
      - `id` (uuid, primary key)
      - `user_account_id` (uuid, foreign key to user_accounts)
      - `onesignal_player_id` (text, OneSignal player/subscription ID)
      - `onesignal_external_id` (text, external user ID for OneSignal)
      - `enabled` (boolean, whether notifications are enabled)
      - `role` (text, user role: driver, supervisor, admin)
      - `driver_id` (uuid, nullable, linked driver if role is driver)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `notification_reminders_log`
      - `id` (uuid, primary key)
      - `driver_id` (uuid, foreign key to drivers)
      - `reminder_date` (date, the date being reminded about)
      - `sent_at` (timestamptz, when reminder was sent)
      - `reminder_type` (text, 'driver' or 'supervisor_summary')
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can manage their own subscriptions
    - Admins can view all subscriptions
    - Reminder logs are read-only for admins/supervisors

  3. Indexes
    - Index on user_account_id for quick lookups
    - Index on driver_id for reminder checks
    - Index on reminder_date for daily queries
*/

-- Create notification_subscriptions table
CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  onesignal_player_id text,
  onesignal_external_id text,
  enabled boolean DEFAULT true,
  role text NOT NULL CHECK (role IN ('driver', 'supervisor', 'admin')),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_account_id)
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_user ON notification_subscriptions(user_account_id);
CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_driver ON notification_subscriptions(driver_id) WHERE driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_enabled ON notification_subscriptions(enabled, role) WHERE enabled = true;

-- Create notification_reminders_log table
CREATE TABLE IF NOT EXISTS notification_reminders_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE,
  reminder_date date NOT NULL DEFAULT CURRENT_DATE,
  sent_at timestamptz DEFAULT now(),
  reminder_type text NOT NULL CHECK (reminder_type IN ('driver', 'supervisor_summary', 'admin_summary')),
  message_content text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for reminder queries
CREATE INDEX IF NOT EXISTS idx_reminders_log_driver_date ON notification_reminders_log(driver_id, reminder_date);
CREATE INDEX IF NOT EXISTS idx_reminders_log_date_type ON notification_reminders_log(reminder_date, reminder_type, sent_at);

-- Enable RLS
ALTER TABLE notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_reminders_log ENABLE ROW LEVEL SECURITY;

-- Policies for notification_subscriptions

-- Users can view their own subscription
CREATE POLICY "Users can view own notification subscription"
  ON notification_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    user_account_id IN (
      SELECT id FROM user_accounts WHERE id = user_account_id
    )
  );

-- Users can insert their own subscription
CREATE POLICY "Users can create own notification subscription"
  ON notification_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_account_id IN (
      SELECT id FROM user_accounts WHERE id = user_account_id
    )
  );

-- Users can update their own subscription
CREATE POLICY "Users can update own notification subscription"
  ON notification_subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    user_account_id IN (
      SELECT id FROM user_accounts WHERE id = user_account_id
    )
  )
  WITH CHECK (
    user_account_id IN (
      SELECT id FROM user_accounts WHERE id = user_account_id
    )
  );

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all notification subscriptions"
  ON notification_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.id = user_account_id
      AND user_accounts.role = 'admin'
    )
  );

-- Policies for notification_reminders_log

-- Admins and supervisors can view reminder logs
CREATE POLICY "Admins and supervisors can view reminder logs"
  ON notification_reminders_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.role IN ('admin', 'supervisor')
    )
  );

-- Service role can insert reminder logs (for Edge Functions)
CREATE POLICY "Service can insert reminder logs"
  ON notification_reminders_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add updated_at trigger for notification_subscriptions
CREATE OR REPLACE FUNCTION update_notification_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_subscriptions_updated_at
  BEFORE UPDATE ON notification_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_subscription_updated_at();
