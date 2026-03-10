/*
  # Create User Accounts Table

  1. New Tables
    - `user_accounts`
      - `id` (uuid, primary key) - Unique identifier for each user account
      - `username` (text, unique, not null) - Unique username for login
      - `email` (text, unique, not null) - Unique email address
      - `password_hash` (text, not null) - Hashed password for security
      - `role` (text, not null) - User role: admin, supervisor, or driver
      - `driver_id` (uuid, nullable) - Foreign key to drivers table (only for driver role)
      - `avatar_url` (text, nullable) - Optional profile picture URL
      - `created_at` (timestamptz) - Account creation timestamp
      - `is_active` (boolean, default true) - Account active status

  2. Security
    - Enable RLS on `user_accounts` table
    - Add policy for authenticated users to read their own account data
    - Add policy for admins to read all accounts
    - Add policy for admins to create/update accounts
    - Add check constraint to ensure role is one of: admin, supervisor, driver
    - Add check constraint to ensure driver_id is set only when role is driver
    - Add foreign key constraint linking driver_id to drivers table

  3. Important Notes
    - This migration does NOT modify existing tables
    - driver_code in drivers table remains unchanged
    - Existing admin authentication via admin_settings table is unaffected
    - This prepares the foundation for future authentication features
*/

-- Create enum-like constraint for role
CREATE TABLE IF NOT EXISTS user_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'supervisor', 'driver')),
  driver_id uuid,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  CONSTRAINT fk_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
  CONSTRAINT driver_id_check CHECK (
    (role = 'driver' AND driver_id IS NOT NULL) OR 
    (role != 'driver' AND driver_id IS NULL)
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_accounts_username ON user_accounts(username);
CREATE INDEX IF NOT EXISTS idx_user_accounts_email ON user_accounts(email);
CREATE INDEX IF NOT EXISTS idx_user_accounts_driver_id ON user_accounts(driver_id);
CREATE INDEX IF NOT EXISTS idx_user_accounts_role ON user_accounts(role);

-- Enable Row Level Security
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own account data
CREATE POLICY "Users can read own account"
  ON user_accounts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Admins can read all accounts
CREATE POLICY "Admins can read all accounts"
  ON user_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts ua
      WHERE ua.id = auth.uid()
      AND ua.role = 'admin'
      AND ua.is_active = true
    )
  );

-- Policy: Admins can insert new accounts
CREATE POLICY "Admins can create accounts"
  ON user_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_accounts ua
      WHERE ua.id = auth.uid()
      AND ua.role = 'admin'
      AND ua.is_active = true
    )
  );

-- Policy: Admins can update accounts
CREATE POLICY "Admins can update accounts"
  ON user_accounts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts ua
      WHERE ua.id = auth.uid()
      AND ua.role = 'admin'
      AND ua.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_accounts ua
      WHERE ua.id = auth.uid()
      AND ua.role = 'admin'
      AND ua.is_active = true
    )
  );

-- Policy: Users can update their own non-critical fields
CREATE POLICY "Users can update own profile"
  ON user_accounts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM user_accounts WHERE id = auth.uid())
    AND driver_id = (SELECT driver_id FROM user_accounts WHERE id = auth.uid())
  );

-- Policy: Admins can delete accounts (soft delete by setting is_active = false is recommended)
CREATE POLICY "Admins can delete accounts"
  ON user_accounts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts ua
      WHERE ua.id = auth.uid()
      AND ua.role = 'admin'
      AND ua.is_active = true
    )
  );
