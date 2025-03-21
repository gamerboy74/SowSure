-- Drop existing policies to avoid conflicts (we'll recreate them)
DROP POLICY IF EXISTS "Users can view own farmer profile" ON farmers;
DROP POLICY IF EXISTS "Users can create own farmer profile" ON farmers;
DROP POLICY IF EXISTS "Users can update own farmer profile" ON farmers;

-- Alter the existing farmers table to add new columns
ALTER TABLE farmers
  -- Drop columns that are no longer needed or need to be modified
  DROP COLUMN IF EXISTS farm_name,
  DROP COLUMN IF EXISTS location,
  
  -- Basic Information
  ADD COLUMN IF NOT EXISTS phone_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '',
  
  -- Identity Verification
  ADD COLUMN IF NOT EXISTS aadhar_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pan_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS farmer_id text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  
  -- Location Details
  ADD COLUMN IF NOT EXISTS complete_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pincode text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS land_type text NOT NULL DEFAULT '',
  
  -- Property Information
  ADD COLUMN IF NOT EXISTS land_size numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS land_number text NOT NULL DEFAULT '',
  
  -- Additional Details
  ADD COLUMN IF NOT EXISTS nominee_name text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add constraints
ALTER TABLE farmers
  ADD CONSTRAINT unique_email UNIQUE (email),
  ADD CONSTRAINT unique_aadhar_number UNIQUE (aadhar_number),
  ADD CONSTRAINT unique_pan_number UNIQUE (pan_number);

-- Ensure RLS is enabled (it's already enabled, but this is just to confirm)
ALTER TABLE farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers
ADD COLUMN IF NOT EXISTS business_name text NOT NULL DEFAULT '';

-- Recreate updated policies
CREATE POLICY "Users can view own farmer profile"
  ON farmers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own farmer profile"
  ON farmers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own farmer profile"
  ON farmers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

  CREATE POLICY "Allow public to view farmer profiles"
  ON farmers FOR SELECT TO public
  USING (true);