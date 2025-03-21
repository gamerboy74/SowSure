/*
  # Fix Storage Policies for Document Uploads

  1. Changes
    - Drop existing storage policies
    - Create more permissive policies for document uploads
    - Add explicit DELETE policies
    - Fix bucket configurations

  2. Security
    - Maintain authenticated user requirements
    - Allow users to manage their own uploads
    - Keep public read access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can upload farmer documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view farmer documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload buyer documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view buyer documents" ON storage.objects;

-- Ensure buckets exist and are configured correctly
UPDATE storage.buckets
SET public = true,
    file_size_limit = 52428800, -- 50MB limit
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf']::text[]
WHERE id IN ('farmer-documents', 'buyer-documents');

-- Create new, more permissive policies for farmer-documents
CREATE POLICY "Public can view farmer documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'farmer-documents');

CREATE POLICY "Authenticated users can upload farmer documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'farmer-documents' AND
  (auth.uid() IS NOT NULL)
);

CREATE POLICY "Users can update own farmer documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'farmer-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own farmer documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'farmer-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create new, more permissive policies for buyer-documents
CREATE POLICY "Public can view buyer documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'buyer-documents');

CREATE POLICY "Authenticated users can upload buyer documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'buyer-documents' AND
  (auth.uid() IS NOT NULL)
);

CREATE POLICY "Users can update own buyer documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'buyer-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own buyer documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'buyer-documents' AND auth.uid()::text = (storage.foldername(name))[1]);