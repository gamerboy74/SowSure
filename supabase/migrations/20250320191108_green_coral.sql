/*
  # Add Products Management System

  1. New Tables
    - `products`
      - `id` (uuid, primary key)
      - `farmer_id` (uuid, references farmers)
      - `name` (text)
      - `description` (text)
      - `price` (numeric)
      - `quantity` (numeric)
      - `unit` (text)
      - `category` (text)
      - `image_url` (text)
      - `status` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for farmers
*/

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid REFERENCES farmers(id) NOT NULL,
  name text NOT NULL,
  description text,
  price numeric NOT NULL CHECK (price >= 0),
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit text NOT NULL,
  category text NOT NULL,
  image_url text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_unit CHECK (
    unit IN ('kg', 'quintal', 'ton', 'piece', 'dozen')
  ),
  CONSTRAINT valid_category CHECK (
    category IN ('grains', 'vegetables', 'fruits', 'pulses', 'herbs', 'other')
  ),
  CONSTRAINT valid_status CHECK (
    status IN ('active', 'draft', 'sold_out', 'archived')
  )
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Farmers can view own products"
  ON products
  FOR SELECT
  TO authenticated
  USING (
    farmer_id IN (
      SELECT id FROM farmers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Farmers can create own products"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    farmer_id IN (
      SELECT id FROM farmers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Farmers can update own products"
  ON products
  FOR UPDATE
  TO authenticated
  USING (
    farmer_id IN (
      SELECT id FROM farmers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Farmers can delete own products"
  ON products
  FOR DELETE
  TO authenticated
  USING (
    farmer_id IN (
      SELECT id FROM farmers WHERE user_id = auth.uid()
    )
  );

-- Create bucket for product images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for product images
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Users can update own product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

CREATE POLICY "Users can delete own product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');