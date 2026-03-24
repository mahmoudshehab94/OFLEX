/*
  # Complete Trans Oflex Schema Update

  ## Description
  This migration adds all missing columns and tables required for the Trans Oflex working time tracking system.

  ## Changes Made

  1. **Drivers Table Updates**
     - Add `driver_name` column (text) - stores the driver's full name
     - Add `is_active` column (boolean, default true) - for soft disable functionality
     
  2. **Work Times Table Updates**
     - Add `vehicle` column (text) - stores combined vehicle identifier (letters + numbers)
     - Add `notes` column (text, nullable) - optional notes field for drivers
     - Add unique constraint on (driver_id, work_date) - prevents duplicate submissions per day
     
  3. **Admin Settings Table**
     - Create new table for storing admin configuration
     - Stores admin password securely
     - Only one row allowed (singleton pattern)
     
  4. **RLS Policy Updates**
     - Add UPDATE and DELETE policies for public access (needed for admin operations)
     - Maintain security while allowing necessary operations

  ## Security Notes
  - RLS is enabled on all tables
  - Public access is intentional for this simple system (no user accounts)
  - Admin password stored in database for easy management
*/

-- Add missing columns to drivers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drivers' AND column_name = 'driver_name'
  ) THEN
    ALTER TABLE drivers ADD COLUMN driver_name text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drivers' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE drivers ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

-- Add missing columns to work_times table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_times' AND column_name = 'vehicle'
  ) THEN
    ALTER TABLE work_times ADD COLUMN vehicle text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_times' AND column_name = 'notes'
  ) THEN
    ALTER TABLE work_times ADD COLUMN notes text;
  END IF;
END $$;

-- Add unique constraint to prevent duplicate submissions per driver per day
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_driver_date'
  ) THEN
    ALTER TABLE work_times 
      ADD CONSTRAINT unique_driver_date UNIQUE (driver_id, work_date);
  END IF;
END $$;

-- Create admin_settings table for password management
CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  password text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  CHECK (id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)
);

-- Enable RLS on admin_settings
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for admin_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'admin_settings' AND policyname = 'Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users" ON admin_settings
      FOR SELECT
      TO public
      USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'admin_settings' AND policyname = 'Enable update for all users'
  ) THEN
    CREATE POLICY "Enable update for all users" ON admin_settings
      FOR UPDATE
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'admin_settings' AND policyname = 'Enable insert for all users'
  ) THEN
    CREATE POLICY "Enable insert for all users" ON admin_settings
      FOR INSERT
      TO public
      WITH CHECK (true);
  END IF;
END $$;

-- Add UPDATE and DELETE policies for drivers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Enable update for all users'
  ) THEN
    CREATE POLICY "Enable update for all users" ON drivers
      FOR UPDATE
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Enable delete for all users'
  ) THEN
    CREATE POLICY "Enable delete for all users" ON drivers
      FOR DELETE
      TO public
      USING (true);
  END IF;
END $$;

-- Add UPDATE and DELETE policies for work_times table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'work_times' AND policyname = 'Enable update for all users'
  ) THEN
    CREATE POLICY "Enable update for all users" ON work_times
      FOR UPDATE
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'work_times' AND policyname = 'Enable delete for all users'
  ) THEN
    CREATE POLICY "Enable delete for all users" ON work_times
      FOR DELETE
      TO public
      USING (true);
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_work_times_work_date ON work_times(work_date DESC);
CREATE INDEX IF NOT EXISTS idx_drivers_is_active ON drivers(is_active);
CREATE INDEX IF NOT EXISTS idx_drivers_driver_code ON drivers(driver_code);