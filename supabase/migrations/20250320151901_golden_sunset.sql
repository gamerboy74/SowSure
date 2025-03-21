/*
  # Add Chat Functionality Tables

  1. New Tables
    - `chats`: Stores chat sessions between users
    - `messages`: Stores individual messages within chats

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  farmer_id uuid REFERENCES farmers(id) NOT NULL,
  buyer_id uuid REFERENCES buyers(id) NOT NULL,
  UNIQUE(farmer_id, buyer_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES chats(id) NOT NULL,
  sender_id uuid REFERENCES auth.users NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Enable RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policies for chats
CREATE POLICY "Users can view their own chats"
  ON chats
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM farmers WHERE id = farmer_id
      UNION
      SELECT user_id FROM buyers WHERE id = buyer_id
    )
  );

CREATE POLICY "Users can create chats"
  ON chats
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM farmers WHERE id = farmer_id
      UNION
      SELECT user_id FROM buyers WHERE id = buyer_id
    )
  );

-- Policies for messages
CREATE POLICY "Users can view messages in their chats"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    chat_id IN (
      SELECT id FROM chats
      WHERE auth.uid() IN (
        SELECT user_id FROM farmers WHERE id = farmer_id
        UNION
        SELECT user_id FROM buyers WHERE id = buyer_id
      )
    )
  );

CREATE POLICY "Users can send messages in their chats"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    chat_id IN (
      SELECT id FROM chats
      WHERE auth.uid() IN (
        SELECT user_id FROM farmers WHERE id = farmer_id
        UNION
        SELECT user_id FROM buyers WHERE id = buyer_id
      )
    )
    AND sender_id = auth.uid()
  );

-- Function to update chat's updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chats
  SET updated_at = now()
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update chat's updated_at timestamp
CREATE TRIGGER update_chat_timestamp
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_chat_timestamp();