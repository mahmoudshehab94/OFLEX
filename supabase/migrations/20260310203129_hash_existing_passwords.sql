/*
  # Hash Existing Passwords Migration

  1. Purpose
    - Convert all existing plain-text passwords to SHA-256 hashes
    - This migration ensures backward compatibility with the new password hashing system
    - All passwords are now hashed for security

  2. Changes
    - Updates all user_accounts records to hash their password_hash field
    - Uses SHA-256 algorithm for consistent hashing across the system
    - This is a one-time migration to secure existing data

  3. Important Notes
    - This migration will run once and hash all passwords
    - Users can continue logging in with their same passwords after this migration
    - New passwords will be automatically hashed by the application layer
*/

-- Create a temporary function to hash passwords using SHA-256
CREATE OR REPLACE FUNCTION hash_sha256(text_input TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(text_input, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Update all existing passwords to be hashed
-- Only update passwords that are NOT already hashed (length != 64)
UPDATE user_accounts
SET password_hash = hash_sha256(password_hash)
WHERE length(password_hash) != 64;

-- Drop the temporary function
DROP FUNCTION IF EXISTS hash_sha256(TEXT);