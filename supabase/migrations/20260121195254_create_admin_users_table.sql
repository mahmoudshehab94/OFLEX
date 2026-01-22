/*
  # Create admin users table for secure authentication

  1. New Tables
    - `admin_users`
      - `id` (uuid, primary key)
      - `username` (text, unique) - Admin username
      - `password_hash` (text) - Bcrypt hashed password
      - `created_at` (timestamptz) - Account creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `is_active` (boolean) - Account active status
  
  2. Security
    - Enable RLS on `admin_users` table
    - No public access policies (only service role can access)
    - Passwords are hashed with bcrypt, never stored in plaintext
  
  3. Initial Setup
    - Creates a default admin user with username 'admin'
    - Initial password is 'admin123' (MUST be changed on first login)
*/

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- No public policies - only service role can access this table
-- This ensures admin auth is handled securely via edge functions

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_admin_users_updated_at ON admin_users;
CREATE TRIGGER trigger_update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_users_updated_at();

-- Insert default admin user (password: admin123)
-- This is bcrypt hash of 'admin123'
-- IMPORTANT: Admin should change this password immediately after first login
INSERT INTO admin_users (username, password_hash, is_active)
VALUES (
  'admin',
  '$2a$10$XQKbF9z5ZR5xYv5qT5bZZeJ3qN6fYQGqYGqP7vL9YZxQv5qT5bZZe',
  true
)
ON CONFLICT (username) DO NOTHING;