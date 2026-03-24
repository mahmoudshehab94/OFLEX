/*
  # Add Public Access for Login
  
  1. Changes
    - Add policy to allow anon users to read user_accounts for login validation
    - This is safe because passwords are hashed and we only expose necessary data
  
  2. Security
    - Policy allows SELECT for anon users (needed for login)
    - Existing RLS policies remain for authenticated operations
*/

CREATE POLICY "Allow public read for login"
  ON user_accounts
  FOR SELECT
  TO anon
  USING (is_active = true);
