/*
  # Fix account_invites check constraint

  1. Changes
    - Drop the existing check constraint that incorrectly requires either driver_id or new_driver_code
    - Add a new check constraint that allows both to be NULL (for supervisor and admin invites)
    - The new constraint only validates that if new_driver_code is provided, then new_driver_name must also be provided
  
  2. Reasoning
    - For driver role: either driver_id (existing driver) OR new_driver_code + new_driver_name (new driver)
    - For supervisor/admin roles: both driver_id and new_driver_code can be NULL
*/

-- Drop the existing check constraint
ALTER TABLE account_invites DROP CONSTRAINT IF EXISTS account_invites_driver_type_check;

-- Add a new check constraint that allows both fields to be NULL
-- This constraint only ensures that if new_driver_code is provided, new_driver_name must also be provided
ALTER TABLE account_invites 
ADD CONSTRAINT account_invites_driver_data_check
CHECK (
  (new_driver_code IS NULL) OR 
  (new_driver_code IS NOT NULL AND new_driver_name IS NOT NULL)
);
