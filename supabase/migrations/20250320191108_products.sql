-- Drop existing table and policies for a clean slate
DROP TABLE IF EXISTS products CASCADE;

-- Updated products table with farmer_id and buyer_id
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid REFERENCES farmers(id),
  buyer_id uuid REFERENCES buyers(id),
  type text NOT NULL CHECK (type IN ('sell', 'buy')),
  name text NOT NULL,
  description text,
  price numeric NOT NULL CHECK (price >= 0),
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit text NOT NULL,
  category text NOT NULL,
  image_url text,
  status text NOT NULL DEFAULT 'active',
  location text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_unit CHECK (unit IN ('kg', 'quintal', 'ton', 'piece', 'dozen')),
  CONSTRAINT valid_category CHECK (category IN ('grains', 'vegetables', 'fruits', 'pulses', 'herbs', 'other')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'draft', 'sold_out', 'archived')),
  CONSTRAINT check_seller_buyer CHECK (
    (type = 'sell' AND farmer_id IS NOT NULL AND buyer_id IS NULL) OR
    (type = 'buy' AND buyer_id IS NOT NULL AND farmer_id IS NULL)
  )
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policies for farmers
CREATE POLICY "Farmers can view own products"
  ON products FOR SELECT TO authenticated
  USING (farmer_id IN (SELECT id FROM farmers WHERE user_id = auth.uid()));

CREATE POLICY "Farmers can create own products"
  ON products FOR INSERT TO authenticated
  WITH CHECK (
    type = 'sell' AND 
    farmer_id IN (SELECT id FROM farmers WHERE user_id = auth.uid()) AND 
    buyer_id IS NULL
  );

CREATE POLICY "Farmers can update own products"
  ON products FOR UPDATE TO authenticated
  USING (farmer_id IN (SELECT id FROM farmers WHERE user_id = auth.uid()));

CREATE POLICY "Farmers can delete own products"
  ON products FOR DELETE TO authenticated
  USING (farmer_id IN (SELECT id FROM farmers WHERE user_id = auth.uid()));

-- Policies for buyers
CREATE POLICY "Buyers can view own products"
  ON products FOR SELECT TO authenticated
  USING (buyer_id IN (SELECT id FROM buyers WHERE user_id = auth.uid()));

CREATE POLICY "Buyers can create own products"
  ON products FOR INSERT TO authenticated
  WITH CHECK (
    type = 'buy' AND 
    buyer_id IN (SELECT id FROM buyers WHERE user_id = auth.uid()) AND 
    farmer_id IS NULL
  );

CREATE POLICY "Buyers can update own products"
  ON products FOR UPDATE TO authenticated
  USING (buyer_id IN (SELECT id FROM buyers WHERE user_id = auth.uid()));

CREATE POLICY "Buyers can delete own products"
  ON products FOR DELETE TO authenticated
  USING (buyer_id IN (SELECT id FROM buyers WHERE user_id = auth.uid()));

-- Policy for marketplace visibility
CREATE POLICY "Anyone can view all products"
  ON products FOR SELECT TO authenticated
  USING (true);

-- Drop existing storage policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;

-- Create storage bucket if it doesn’t exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Updated storage policies
CREATE POLICY "Anyone can view product images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Users can update own product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );