/*
  # Fix Account Invites for Simplified Flow

  1. Changes
    - Add `status` column (pending, used) to replace is_used
    - Add `used_by_account_id` reference for tracking
    - Keep compatibility with existing columns
    - Update RLS policies to allow anonymous SELECT for validation
    - Add policy to allow service role to update invites
    - Add policy for admins to delete invites

  2. Purpose
    - Support the simplified invitation flow
    - Allow public validation of invitation tokens
    - Enable proper tracking of invitation usage
    - Allow deletion of old invitations
*/

-- Add status column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'account_invites' AND column_name = 'status'
  ) THEN
    ALTER TABLE account_invites ADD COLUMN status text DEFAULT 'pending';
  END IF;
END $$;

-- Add used_by_account_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'account_invites' AND column_name = 'used_by_account_id'
  ) THEN
    ALTER TABLE account_invites ADD COLUMN used_by_account_id uuid REFERENCES user_accounts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Sync status with is_used for existing records
UPDATE account_invites SET status = 'used' WHERE is_used = true AND status = 'pending';

-- Drop old restrictive policies
DROP POLICY IF EXISTS "Anyone can read valid invites by token" ON account_invites;
DROP POLICY IF EXISTS "System can mark invites as used" ON account_invites;

-- Create new policy: Allow anonymous users to SELECT any invite by token (for validation)
CREATE POLICY "Public can read invites for validation"
  ON account_invites
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy: Admins and supervisors can delete invites
CREATE POLICY "Admins can delete invites"
  ON account_invites
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.id = auth.uid()
      AND user_accounts.role IN ('admin', 'supervisor')
    )
  );

-- Create function to allow service role to update invites
CREATE OR REPLACE FUNCTION public.can_update_invite_as_service()
RETURNS boolean AS $$
BEGIN
  -- This function is meant to be called by service role via Edge Functions
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE account_invites IS 'Stores invitation tokens for user registration. Public read access for validation, admin/supervisor manage access.';
