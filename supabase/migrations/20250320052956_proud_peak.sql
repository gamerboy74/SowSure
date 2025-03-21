/*
  # Setup Storage Buckets for File Uploads

  1. New Buckets
    - farmer-documents: For farmer profile photos and documents
    - buyer-documents: For buyer profile photos and trade licenses

  2. Security
    - Enable public access for viewing files
    - Restrict uploads to authenticated users
*/

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('farmer-documents', 'farmer-documents', true),
  ('buyer-documents', 'buyer-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Set up security policies for farmer-documents bucket
CREATE POLICY "Authenticated users can upload farmer documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'farmer-documents' AND
    (auth.uid() IS NOT NULL)
  );

CREATE POLICY "Anyone can view farmer documents"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'farmer-documents');

-- Set up security policies for buyer-documents bucket
CREATE POLICY "Authenticated users can upload buyer documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'buyer-documents' AND
    (auth.uid() IS NOT NULL)
  );

CREATE POLICY "Anyone can view buyer documents"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'buyer-documents');