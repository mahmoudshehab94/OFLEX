/*
  # Add Username and Email Local Part to Account Invites

  1. Changes
    - Add `username` (text, nullable) - Pre-filled username for the invited user
    - Add `email_local_part` (text, nullable) - The part before @malek.com for the email

  2. Purpose
    - Allow admin to specify username upfront during invite creation
    - Support fixed domain email (@malek.com) by storing only local part
    - Pre-fill username field (read-only) in registration form
    - Simplify email input for users by only asking for local part
*/

-- Add username and email_local_part fields to account_invites table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'account_invites' AND column_name = 'username'
  ) THEN
    ALTER TABLE account_invites ADD COLUMN username text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'account_invites' AND column_name = 'email_local_part'
  ) THEN
    ALTER TABLE account_invites ADD COLUMN email_local_part text;
  END IF;
END $$;