/*
  # Add Notifications System

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `title` (text)
      - `message` (text) 
      - `type` (text)
      - `read` (boolean)
      - `created_at` (timestamp)
      - `read_at` (timestamp)
      - `data` (jsonb)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz,
  data jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT valid_type CHECK (
    type IN ('system', 'order', 'message', 'payment', 'alert')
  )
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Insert sample notifications
INSERT INTO notifications (user_id, title, message, type, data)
SELECT 
  auth.uid(),
  'Welcome to FarmConnect!',
  'Thank you for joining our platform. Start exploring the marketplace today.',
  'system',
  '{"action": "explore_marketplace", "url": "/marketplace"}'::jsonb
FROM auth.users
WHERE auth.users.email = 'admin@farmconnect.com';