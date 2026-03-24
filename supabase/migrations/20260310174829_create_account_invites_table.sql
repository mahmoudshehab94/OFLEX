/*
  # Create Account Invites Table

  1. New Tables
    - `account_invites`
      - `id` (uuid, primary key) - Unique identifier for the invite
      - `token` (text, unique) - Unique token used in the invite link
      - `role` (text) - Role to assign when invite is used (driver, supervisor, admin)
      - `driver_id` (uuid, nullable) - Optional reference to driver if invite is for linking to a driver
      - `created_by` (uuid) - Reference to the admin/user who created the invite
      - `expires_at` (timestamptz) - Expiration timestamp (1 hour from creation)
      - `used_at` (timestamptz, nullable) - Timestamp when invite was used
      - `is_used` (boolean) - Flag indicating if invite has been used
      - `created_at` (timestamptz) - Creation timestamp

  2. Security
    - Enable RLS on `account_invites` table
    - Add policy for authenticated users to read active invites
    - Add policy for admins to create invites
    - Add policy for admins to view all invites

  3. Indexes
    - Index on token for fast lookup
    - Index on expires_at for cleanup queries
*/

-- Create account_invites table
CREATE TABLE IF NOT EXISTS account_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('driver', 'supervisor', 'admin')),
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  created_by uuid REFERENCES user_accounts(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  is_used boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_invites_token ON account_invites(token);
CREATE INDEX IF NOT EXISTS idx_account_invites_expires_at ON account_invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_account_invites_is_used ON account_invites(is_used);

-- Enable RLS
ALTER TABLE account_invites ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read valid (non-expired, unused) invites by token
CREATE POLICY "Anyone can read valid invites by token"
  ON account_invites
  FOR SELECT
  USING (
    is_used = false 
    AND expires_at > now()
  );

-- Policy: Authenticated admins can create invites
CREATE POLICY "Admins can create invites"
  ON account_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.id = auth.uid()
      AND user_accounts.role = 'admin'
    )
  );

-- Policy: Authenticated admins can view all invites
CREATE POLICY "Admins can view all invites"
  ON account_invites
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.id = auth.uid()
      AND user_accounts.role = 'admin'
    )
  );

-- Policy: Authenticated admins can update invites (for marking as used)
CREATE POLICY "Admins can update invites"
  ON account_invites
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.id = auth.uid()
      AND user_accounts.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.id = auth.uid()
      AND user_accounts.role = 'admin'
    )
  );

-- Policy: System can update invites when used (for registration process)
CREATE POLICY "System can mark invites as used"
  ON account_invites
  FOR UPDATE
  USING (is_used = false AND expires_at > now())
  WITH CHECK (is_used = true AND used_at IS NOT NULL);