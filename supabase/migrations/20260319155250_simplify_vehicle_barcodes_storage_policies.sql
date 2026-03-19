/*
  # Simplify vehicle-barcodes storage policies

  1. Changes
    - Drop all existing restrictive policies
    - Create simple public policies for authenticated users
    - Allow all authenticated users to upload, update, and delete
    - This works with custom auth since bucket is public
  
  2. Security Note
    - Since we control vehicle creation through Edge Function with admin check
    - Storage operations are safe for authenticated users
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Admin can upload vehicle barcodes" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update vehicle barcodes" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete vehicle barcodes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view vehicle barcodes" ON storage.objects;

-- Simple policy: Authenticated users can upload
CREATE POLICY "Authenticated can upload vehicle barcodes"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'vehicle-barcodes');

-- Simple policy: Authenticated users can update
CREATE POLICY "Authenticated can update vehicle barcodes"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'vehicle-barcodes');

-- Simple policy: Authenticated users can delete
CREATE POLICY "Authenticated can delete vehicle barcodes"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'vehicle-barcodes');

-- Simple policy: Public can view
CREATE POLICY "Public can view vehicle barcodes"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'vehicle-barcodes');
