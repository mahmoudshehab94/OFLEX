/*
  # Add Admin Profile Fields

  1. Changes to user_accounts table
    - Add `full_name` column (text, nullable)
    - Add `phone` column (text, nullable)
    - Add `avatar_url` column (text, nullable)

  2. Notes
    - These fields allow admins and supervisors to maintain complete profile information
    - Avatar URL will store the path to the user's profile picture in Supabase Storage
    - Phone number stored as text to support international formats
*/

DO $$
BEGIN
  -- Add full_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_accounts' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE user_accounts ADD COLUMN full_name text;
  END IF;

  -- Add phone column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_accounts' AND column_name = 'phone'
  ) THEN
    ALTER TABLE user_accounts ADD COLUMN phone text;
  END IF;

  -- Add avatar_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_accounts' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE user_accounts ADD COLUMN avatar_url text;
  END IF;
END $$;