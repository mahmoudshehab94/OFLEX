/*
  # Fix vehicles RLS policies for custom authentication

  1. Changes
    - Drop existing policies that use auth.uid()
    - Create new policies compatible with custom authentication
    - Allow authenticated users in user_accounts to manage vehicles
  
  2. Security
    - Admins can fully manage vehicles (SELECT, INSERT, UPDATE, DELETE)
    - Drivers and supervisors can read vehicles
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage all vehicles" ON vehicles;
DROP POLICY IF EXISTS "Drivers can view all vehicles" ON vehicles;

-- Policy: Admin users can perform all operations on vehicles
CREATE POLICY "Admins can select vehicles"
  ON vehicles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.email = current_user
      AND user_accounts.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert vehicles"
  ON vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.email = current_user
      AND user_accounts.role = 'admin'
    )
  );

CREATE POLICY "Admins can update vehicles"
  ON vehicles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.email = current_user
      AND user_accounts.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.email = current_user
      AND user_accounts.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete vehicles"
  ON vehicles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.email = current_user
      AND user_accounts.role = 'admin'
    )
  );

-- Policy: Drivers and supervisors can view vehicles
CREATE POLICY "Drivers and supervisors can view vehicles"
  ON vehicles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.email = current_user
      AND user_accounts.role IN ('driver', 'supervisor')
    )
  );
