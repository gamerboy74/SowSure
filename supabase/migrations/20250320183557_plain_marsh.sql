/*
  # Add Site Settings Table

  1. New Table
    - `site_settings`: Stores global site configuration
    - Single row table with JSON columns for complex settings

  2. Security
    - Enable RLS
    - Only allow admin access
*/

-- Create site_settings table
CREATE TABLE IF NOT EXISTS site_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Ensures single row
  site_name TEXT NOT NULL DEFAULT 'FarmConnect',
  support_email TEXT NOT NULL DEFAULT 'support@farmconnect.com',
  max_file_size INT NOT NULL DEFAULT 10,
  allow_registration BOOLEAN NOT NULL DEFAULT true,
  require_email_verification BOOLEAN NOT NULL DEFAULT false,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  contact_phone TEXT NOT NULL DEFAULT '+91 123 456 7890',
  contact_address TEXT NOT NULL DEFAULT '123 Agriculture Road, Farming District, New Delhi, 110001',
  social_links JSONB NOT NULL DEFAULT '{
    "facebook": "https://facebook.com/farmconnect",
    "twitter": "https://twitter.com/farmconnect",
    "instagram": "https://instagram.com/farmconnect",
    "linkedin": "https://linkedin.com/company/farmconnect"
  }',
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 2.5,
  min_withdrawal DECIMAL(10,2) NOT NULL DEFAULT 1000,
  max_withdrawal DECIMAL(10,2) NOT NULL DEFAULT 100000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Allow admin read access to site settings"
  ON site_settings
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Allow admin write access to site settings"
  ON site_settings
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  ));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_site_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp
CREATE TRIGGER update_site_settings_timestamp
  BEFORE UPDATE ON site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_site_settings_timestamp();

-- Insert initial settings if table is empty
INSERT INTO site_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;