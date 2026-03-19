/*
  # Add ID barcode image field to drivers table

  1. Changes
    - Add id_barcode_image_url column to drivers table
    - Field stores URL to driver's ID barcode image
    - Optional field (NULL allowed)
  
  2. Security
    - No policy changes needed
    - Existing RLS policies cover this field
    - Drivers can update their own id_barcode_image_url via Edge Function
*/

-- Add id_barcode_image_url column to drivers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'id_barcode_image_url'
  ) THEN
    ALTER TABLE drivers ADD COLUMN id_barcode_image_url text;
  END IF;
END $$;
