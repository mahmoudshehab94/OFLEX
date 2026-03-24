/*
  # Fix User Accounts Cascade Delete

  1. Changes
    - Update foreign key constraint on user_accounts.driver_id
    - Change ON DELETE behavior from SET NULL to CASCADE
    - This ensures when a driver is deleted, their user account is automatically deleted
    - Prevents violation of driver_id_check constraint

  2. Security
    - No changes to RLS policies
*/

-- Drop the existing foreign key constraint
ALTER TABLE user_accounts 
DROP CONSTRAINT IF EXISTS fk_driver;

-- Recreate the foreign key constraint with CASCADE delete
ALTER TABLE user_accounts
ADD CONSTRAINT fk_driver 
FOREIGN KEY (driver_id) 
REFERENCES drivers(id) 
ON DELETE CASCADE;