/*
  # Security and Performance Improvements

  1. Performance Enhancement
    - Add index on `work_times.driver_id` foreign key for optimal query performance
    - This index improves JOIN performance and foreign key lookups

  2. RLS Policy Refinement
    - Note: The current RLS policies allow public insert access by design
    - This is intentional for the driver submission form functionality
    - However, we'll add some basic validation constraints to prevent abuse

  3. Data Validation
    - Add check constraints to ensure data quality
    - Prevent empty strings and ensure reasonable time ranges
*/

-- Add index for foreign key performance
CREATE INDEX IF NOT EXISTS idx_work_times_driver_id ON work_times(driver_id);

-- Add check constraints for data validation
ALTER TABLE drivers 
  DROP CONSTRAINT IF EXISTS check_driver_code_not_empty,
  DROP CONSTRAINT IF EXISTS check_license_letters_not_empty,
  DROP CONSTRAINT IF EXISTS check_license_numbers_not_empty;

ALTER TABLE drivers
  ADD CONSTRAINT check_driver_code_not_empty CHECK (length(trim(driver_code)) > 0),
  ADD CONSTRAINT check_license_letters_not_empty CHECK (length(trim(license_letters)) > 0),
  ADD CONSTRAINT check_license_numbers_not_empty CHECK (length(trim(license_numbers)) > 0);

-- Add check constraints for work times
ALTER TABLE work_times
  DROP CONSTRAINT IF EXISTS check_end_after_start;

ALTER TABLE work_times
  ADD CONSTRAINT check_end_after_start CHECK (end_time > start_time);