/*
  # Add Driver to User Account Linkage

  1. Purpose
    - Allow existing drivers to be linked to user accounts
    - Enable one-to-one relationship between drivers and user accounts
    - Preserve all existing driver data and work_entries functionality

  2. Changes
    - Add unique constraint on user_accounts.driver_id to ensure one-to-one relationship
    - The foreign key constraint from user_accounts.driver_id to drivers.id already exists
    - Add index for reverse lookup (finding user account for a given driver)

  3. Important Notes
    - NO drivers are deleted or modified
    - work_entries continue to reference drivers.id directly
    - driver_code remains unchanged and functional
    - Existing admin authentication is unaffected
    - This migration only adds constraints, no data changes

  4. Relationship Structure
    - drivers table: Existing driver records (unchanged)
    - user_accounts table: New user accounts that can be linked to drivers
    - One driver can have at most one user account (enforced by unique constraint)
    - User accounts with role='driver' MUST have a driver_id (enforced by existing check constraint)
    - User accounts with role!='driver' MUST NOT have a driver_id (enforced by existing check constraint)
*/

-- Add unique constraint to ensure one-to-one relationship between driver and user account
-- This ensures that each driver can only be linked to one user account
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_accounts_driver_id_unique'
  ) THEN
    ALTER TABLE user_accounts 
    ADD CONSTRAINT user_accounts_driver_id_unique 
    UNIQUE (driver_id);
  END IF;
END $$;

-- Create index for reverse lookup (finding user account by driver_id)
-- This index already exists from the previous migration, but we ensure it's there
CREATE INDEX IF NOT EXISTS idx_user_accounts_driver_id ON user_accounts(driver_id);

-- Add helpful comment explaining the relationship
COMMENT ON COLUMN user_accounts.driver_id IS 'Foreign key to drivers.id. Must be NOT NULL when role=driver, must be NULL otherwise. Unique constraint ensures one-to-one relationship.';

-- Verify the constraints are in place
DO $$
DECLARE
  fk_exists boolean;
  unique_exists boolean;
  check_exists boolean;
BEGIN
  -- Check foreign key exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_driver' 
    AND table_name = 'user_accounts'
  ) INTO fk_exists;
  
  -- Check unique constraint exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_accounts_driver_id_unique' 
    AND table_name = 'user_accounts'
  ) INTO unique_exists;
  
  -- Check the driver_id_check constraint exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'driver_id_check' 
    AND table_name = 'user_accounts'
  ) INTO check_exists;
  
  IF NOT fk_exists THEN
    RAISE EXCEPTION 'Foreign key constraint fk_driver is missing';
  END IF;
  
  IF NOT unique_exists THEN
    RAISE EXCEPTION 'Unique constraint user_accounts_driver_id_unique is missing';
  END IF;
  
  IF NOT check_exists THEN
    RAISE EXCEPTION 'Check constraint driver_id_check is missing';
  END IF;
  
  RAISE NOTICE 'All constraints verified successfully';
END $$;
