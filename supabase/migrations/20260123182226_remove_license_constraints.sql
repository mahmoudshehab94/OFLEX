/*
  # Remove License Field Constraints

  ## Changes
  This migration removes the check constraints on license_letters and license_numbers
  fields in the drivers table, as these fields are no longer required for the 
  Trans Oflex system. Vehicle information is now stored in work_entries.

  ## Actions
  1. Drop check constraints for license_letters and license_numbers
  2. Make these fields nullable for flexibility
  3. Update existing empty values to NULL for data consistency

  ## Reason
  The admin should be able to add drivers with just a code and name.
  License information is legacy data that's not actively used in the current workflow.
*/

-- Drop the check constraints that require non-empty values
ALTER TABLE drivers 
  DROP CONSTRAINT IF EXISTS check_license_letters_not_empty,
  DROP CONSTRAINT IF EXISTS check_license_numbers_not_empty;

-- Make the license fields nullable
ALTER TABLE drivers 
  ALTER COLUMN license_letters DROP NOT NULL,
  ALTER COLUMN license_numbers DROP NOT NULL;

-- Update existing empty strings to NULL for consistency
UPDATE drivers 
SET license_letters = NULL 
WHERE license_letters = '' OR trim(license_letters) = '';

UPDATE drivers 
SET license_numbers = NULL 
WHERE license_numbers = '' OR trim(license_numbers) = '';
