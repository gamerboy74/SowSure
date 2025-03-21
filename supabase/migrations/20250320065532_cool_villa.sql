/*
  # Remove Authorization Requirements for File Uploads

  1. Changes
    - Drop existing storage policies
    - Create new policies allowing unrestricted uploads
    - Keep public read access
    - Remove auth checks for uploads

  2. Security
    - Allow public uploads without authentication
    - Maintain public read access
    - Remove size and type restrictions
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Public can view farmer documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload farmer documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own farmer documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own farmer documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view buyer documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload buyer documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own buyer documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own buyer documents" ON storage.objects;

-- Update bucket configurations to remove restrictions
UPDATE storage.buckets
SET public = true,
    file_size_limit = null,
    allowed_mime_types = null
WHERE id IN ('farmer-documents', 'buyer-documents');

-- Create new unrestricted policies for farmer-documents
CREATE POLICY "Anyone can view farmer documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'farmer-documents');

CREATE POLICY "Anyone can upload farmer documents"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'farmer-documents');

CREATE POLICY "Anyone can update farmer documents"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'farmer-documents');

CREATE POLICY "Anyone can delete farmer documents"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'farmer-documents');

-- Create new unrestricted policies for buyer-documents
CREATE POLICY "Anyone can view buyer documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'buyer-documents');

CREATE POLICY "Anyone can upload buyer documents"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'buyer-documents');

CREATE POLICY "Anyone can update buyer documents"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'buyer-documents');

CREATE POLICY "Anyone can delete buyer documents"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'buyer-documents');