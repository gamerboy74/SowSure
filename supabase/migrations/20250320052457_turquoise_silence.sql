/*
  # Enhanced Buyer Registration Schema

  1. Changes
    - Add new fields to buyers table for enhanced registration
    - Add constraints and validations
    - Update security policies

  2. New Fields
    - Basic Information
      - phone_number
      - gstin
      - business_type
      - trade_license_url
    - Business Details
      - purchase_capacity
      - storage_capacity
      - business_address
      - pincode
    - Additional Details
      - terms_accepted
      - profile_photo_url
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own buyer profile" ON buyers;
DROP POLICY IF EXISTS "Users can create own buyer profile" ON buyers;
DROP POLICY IF EXISTS "Users can update own buyer profile" ON buyers;

-- Alter buyers table to add new columns
ALTER TABLE buyers
  -- Basic Information
  ADD COLUMN IF NOT EXISTS phone_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gstin text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS trade_license_url text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  
  -- Business Details
  ADD COLUMN IF NOT EXISTS purchase_capacity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_capacity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS business_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pincode text NOT NULL DEFAULT '',
  
  -- Additional Details
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add constraints
ALTER TABLE buyers
  ADD CONSTRAINT unique_gstin UNIQUE (gstin);

-- Ensure RLS is enabled
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;

-- Recreate policies
CREATE POLICY "Users can view own buyer profile"
  ON buyers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own buyer profile"
  ON buyers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own buyer profile"
  ON buyers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);