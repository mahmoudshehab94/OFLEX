/*
  # Add New Driver Fields to Account Invites

  1. Changes
    - Add `new_driver_code` (text, nullable) - Driver code for new driver invites
    - Add `new_driver_name` (text, nullable) - Driver name for new driver invites
    - Add `new_driver_license_letters` (text, nullable) - License letters for new driver
    - Add `new_driver_license_numbers` (text, nullable) - License numbers for new driver
    - Add constraint to ensure either driver_id OR new driver fields are provided

  2. Purpose
    - Support creating invites for completely new drivers who don't exist yet
    - Allow admin to specify driver details upfront for new driver invites
    - Maintain backward compatibility with existing driver_id-based invites
*/

-- Add new driver fields to account_invites table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'account_invites' AND column_name = 'new_driver_code'
  ) THEN
    ALTER TABLE account_invites ADD COLUMN new_driver_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'account_invites' AND column_name = 'new_driver_name'
  ) THEN
    ALTER TABLE account_invites ADD COLUMN new_driver_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'account_invites' AND column_name = 'new_driver_license_letters'
  ) THEN
    ALTER TABLE account_invites ADD COLUMN new_driver_license_letters text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'account_invites' AND column_name = 'new_driver_license_numbers'
  ) THEN
    ALTER TABLE account_invites ADD COLUMN new_driver_license_numbers text;
  END IF;
END $$;

-- Add constraint to ensure either driver_id OR new driver fields are provided (but not both)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'account_invites_driver_type_check'
  ) THEN
    ALTER TABLE account_invites
    ADD CONSTRAINT account_invites_driver_type_check
    CHECK (
      (driver_id IS NOT NULL AND new_driver_code IS NULL) OR
      (driver_id IS NULL AND new_driver_code IS NOT NULL)
    );
  END IF;
END $$;