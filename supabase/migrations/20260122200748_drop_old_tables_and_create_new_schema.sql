/*
  # Drop old tables and create new schema

  1. Drop Old Tables
    - Drop old `work_logs` table (has foreign key to old drivers)
    - Drop old `drivers` table (integer code based)
    - Drop old `admin_users` table (no longer needed)

  2. New Tables
    - `drivers`
      - `id` (uuid, primary key, auto-generated)
      - `driver_code` (text, driver identification code)
      - `license_letters` (text, license plate letters)
      - `license_numbers` (text, license plate numbers)
      - `created_at` (timestamptz, auto-set to current time)
    
    - `work_times`
      - `id` (uuid, primary key, auto-generated)
      - `driver_id` (uuid, foreign key to drivers)
      - `start_time` (time, work start time)
      - `end_time` (time, work end time)
      - `work_date` (date, defaults to current date)
      - `created_at` (timestamptz, auto-set to current time)

  3. Security
    - Enable RLS on both tables
    - Add policies to allow public read and insert access
*/

DROP TABLE IF EXISTS work_logs CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;

CREATE TABLE drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_code text NOT NULL,
  license_letters text NOT NULL,
  license_numbers text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE work_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  start_time time NOT NULL,
  end_time time NOT NULL,
  work_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON drivers
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable insert for all users" ON drivers
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON work_times
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Enable insert for all users" ON work_times
  FOR INSERT
  TO public
  WITH CHECK (true);