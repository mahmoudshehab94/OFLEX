/*
  # Create vehicles table for barcode management

  1. New Tables
    - `vehicles`
      - `id` (uuid, primary key)
      - `plate_letters` (text) - Vehicle letters (e.g., "MI")
      - `plate_number` (text) - Vehicle number (e.g., "299")
      - `vehicle_code_image_url` (text) - URL to Fahrzeugcode barcode image
      - `cooling_code_image_url` (text) - URL to Kühlcode barcode image
      - `standard_code_image_url` (text) - URL to Standardcode barcode image
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `vehicles` table
    - Add policy for authenticated admin users to manage vehicles
    - Add policy for authenticated drivers to read vehicles (for future barcode display)
  
  3. Important Notes
    - Unique constraint on combination of plate_letters + plate_number
    - All barcode image fields are required (NOT NULL)
    - Timestamps auto-update on changes
*/

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_letters text NOT NULL,
  plate_number text NOT NULL,
  vehicle_code_image_url text NOT NULL,
  cooling_code_image_url text NOT NULL,
  standard_code_image_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_vehicle_plate UNIQUE (plate_letters, plate_number)
);

-- Enable RLS
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Policy: Admin users can manage all vehicles
CREATE POLICY "Admins can manage all vehicles"
  ON vehicles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.id = auth.uid()
      AND user_accounts.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.id = auth.uid()
      AND user_accounts.role = 'admin'
    )
  );

-- Policy: Drivers can read all vehicles (for future barcode display feature)
CREATE POLICY "Drivers can view all vehicles"
  ON vehicles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.id = auth.uid()
      AND user_accounts.role = 'driver'
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_vehicles_updated_at'
  ) THEN
    CREATE TRIGGER update_vehicles_updated_at
      BEFORE UPDATE ON vehicles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
