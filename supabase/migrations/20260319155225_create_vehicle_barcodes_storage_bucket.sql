/*
  # Create vehicle-barcodes storage bucket

  1. Storage
    - Create `vehicle-barcodes` bucket for storing barcode images
    - Set public access to true for easy retrieval
  
  2. Security
    - Admin users can upload, update, and delete barcode images
    - All authenticated users can view barcode images
*/

-- Create storage bucket for vehicle barcodes if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'vehicle-barcodes'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('vehicle-barcodes', 'vehicle-barcodes', true);
  END IF;
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin can upload vehicle barcodes" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update vehicle barcodes" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete vehicle barcodes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view vehicle barcodes" ON storage.objects;

-- Policy: Admin users can upload vehicle barcode images
CREATE POLICY "Admin can upload vehicle barcodes"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-barcodes'
    AND EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.email = current_user
      AND user_accounts.role = 'admin'
      AND user_accounts.is_active = true
    )
  );

-- Policy: Admin users can update vehicle barcode images
CREATE POLICY "Admin can update vehicle barcodes"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vehicle-barcodes'
    AND EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.email = current_user
      AND user_accounts.role = 'admin'
      AND user_accounts.is_active = true
    )
  );

-- Policy: Admin users can delete vehicle barcode images
CREATE POLICY "Admin can delete vehicle barcodes"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vehicle-barcodes'
    AND EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_accounts.email = current_user
      AND user_accounts.role = 'admin'
      AND user_accounts.is_active = true
    )
  );

-- Policy: Anyone can view vehicle barcode images (public bucket)
CREATE POLICY "Anyone can view vehicle barcodes"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'vehicle-barcodes');
