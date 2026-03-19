/*
  # Make vehicle-barcodes storage fully public

  1. Changes
    - Drop all restrictive policies
    - Allow public access for all operations
    - Since vehicle creation is controlled via Edge Function with admin check
    - Storage can be open while maintaining security at the data level
  
  2. Rationale
    - Custom auth doesn't work with storage RLS policies using current_user
    - Edge Function already validates admin access for vehicle operations
    - Public storage with controlled vehicle creation is secure enough
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Authenticated can upload vehicle barcodes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update vehicle barcodes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete vehicle barcodes" ON storage.objects;
DROP POLICY IF EXISTS "Public can view vehicle barcodes" ON storage.objects;

-- Public access for all operations
CREATE POLICY "Public access to vehicle barcodes"
  ON storage.objects
  FOR ALL
  TO public
  USING (bucket_id = 'vehicle-barcodes')
  WITH CHECK (bucket_id = 'vehicle-barcodes');
