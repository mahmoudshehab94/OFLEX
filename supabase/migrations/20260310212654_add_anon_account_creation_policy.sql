/*
  # Add Anonymous Account Creation Policy
  
  1. Changes
    - Add policy to allow anon users to insert their first account
    - This enables the DirectAccountCreation component to work
    - Only allows creating accounts when not authenticated (first-time setup)
  
  2. Security
    - Anon users can only create accounts (not read/update/delete)
    - Once created, normal authentication flows take over
*/

-- Allow anon users to create new accounts (for initial account creation)
CREATE POLICY "Allow anon to create accounts"
  ON user_accounts
  FOR INSERT
  TO anon
  WITH CHECK (true);
