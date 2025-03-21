/*
  # Add Initial Admin User and Setup - Consolidated Script

  1. Changes
    - Create admin_users table if it doesn't exist
    - Add initial admin user to auth.users (with existence check)
    - Create corresponding admin profile in admin_users
    - Add function to check auth user existence
    - Add function to check admin status
    - Add corrected RLS policies and permissions
*/

-- Enable required extensions (if not already enabled)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    CREATE EXTENSION pgcrypto;
  END IF;
END $$;

-- Create the admin_users table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create a function to check if an email exists in auth.users
CREATE OR REPLACE FUNCTION check_auth_user_exists(email text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users WHERE auth.users.email = check_auth_user_exists.email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users WHERE admin_users.user_id = $1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add the initial admin user to auth.users and admin_users
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Check if the admin user already exists in auth.users
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'admin@farmconnect.com';

  -- If the user doesn’t exist, create them
  IF admin_user_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000', -- Default instance_id for single-tenant
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@farmconnect.com',
      crypt('admin123', gen_salt('bf')), -- Default password: admin123
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"type":"admin"}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO admin_user_id;
  END IF;

  -- Ensure the admin user is in admin_users
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO admin_users (id, user_id, name, email)
    SELECT 
      gen_random_uuid(),
      admin_user_id,
      'Admin User',
      'admin@farmconnect.com'
    ON CONFLICT (email) DO NOTHING;
  END IF;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO postgres;
GRANT SELECT ON auth.users TO postgres;

-- Drop any existing problematic RLS policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'admin_users' 
    AND policyname = 'Enable all access for admin users'
  ) THEN
    DROP POLICY "Enable all access for admin users" ON admin_users;
  END IF;
  IF EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'admin_users' 
    AND policyname = 'Allow authenticated users to read own admin status'
  ) THEN
    DROP POLICY "Allow authenticated users to read own admin status" ON admin_users;
  END IF;
  IF EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'admin_users' 
    AND policyname = 'Admins can view admin users'
  ) THEN
    DROP POLICY "Admins can view admin users" ON admin_users;
  END IF;
  IF EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'admin_users' 
    AND policyname = 'Admins can update own profile'
  ) THEN
    DROP POLICY "Admins can update own profile" ON admin_users;
  END IF;
END;
$$;

-- Enable Row-Level Security on admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Add corrected RLS policies for admin_users
CREATE POLICY "Allow authenticated users to read own admin status" ON admin_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view admin users" ON admin_users
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update own profile" ON admin_users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Verify the setup (optional, for debugging)
DO $$
BEGIN
  RAISE NOTICE 'Admin user setup complete. Check auth.users and admin_users for admin@farmconnect.com';
END;
$$;