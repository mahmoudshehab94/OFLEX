/*
  # Make vehicle code images optional

  1. Changes
    - Make vehicle_code_image_url nullable
    - Make cooling_code_image_url nullable
    - Make standard_code_image_url nullable
  
  2. Purpose
    - Allow vehicles to be created without codes
    - Codes can be added/updated/deleted later
*/

-- Make code image columns nullable
ALTER TABLE vehicles 
  ALTER COLUMN vehicle_code_image_url DROP NOT NULL,
  ALTER COLUMN cooling_code_image_url DROP NOT NULL,
  ALTER COLUMN standard_code_image_url DROP NOT NULL;
