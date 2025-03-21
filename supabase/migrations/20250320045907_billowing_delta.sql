/*
  # Initial Schema Setup for FarmConnect

  1. New Tables
    - `farmers`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `farm_name` (text)
      - `location` (text)
      - `wallet_address` (text)
      - `created_at` (timestamp)
    
    - `buyers`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `company_name` (text)
      - `contact_name` (text)
      - `email` (text)
      - `wallet_address` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create farmers table
CREATE TABLE IF NOT EXISTS farmers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  farm_name text NOT NULL,
  location text NOT NULL,
  wallet_address text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(wallet_address)
);

-- Create buyers table
CREATE TABLE IF NOT EXISTS buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  wallet_address text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(wallet_address),
  UNIQUE(email)
);

-- Enable RLS
ALTER TABLE farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;

-- Policies for farmers
CREATE POLICY "Users can view own farmer profile"
  ON farmers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own farmer profile"
  ON farmers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own farmer profile"
  ON farmers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for buyers
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