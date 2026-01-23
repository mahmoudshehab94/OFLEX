/*
  # Add Unique Constraint to Driver Code

  ## Changes
  This migration adds a unique constraint to the driver_code field to ensure
  that no two drivers can have the same code in the system.

  ## Actions
  1. Add unique constraint to driver_code column
  2. Create unique index for performance

  ## Security
  - Prevents duplicate driver codes
  - Maintains data integrity
*/

-- Add unique constraint to driver_code
ALTER TABLE drivers
  DROP CONSTRAINT IF EXISTS drivers_driver_code_key;

ALTER TABLE drivers
  ADD CONSTRAINT drivers_driver_code_key UNIQUE (driver_code);

-- Create index for performance (if not exists from constraint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_code_unique ON drivers(driver_code);
