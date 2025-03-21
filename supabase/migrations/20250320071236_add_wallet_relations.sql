-- Drop existing constraints if they exist
ALTER TABLE IF EXISTS wallet_funding_requests 
  DROP CONSTRAINT IF EXISTS wallet_funding_requests_user_id_fkey,
  DROP CONSTRAINT IF EXISTS wallet_funding_requests_wallet_id_fkey;

-- Add foreign key constraints
ALTER TABLE wallet_funding_requests
  ADD CONSTRAINT wallet_funding_requests_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE wallet_funding_requests
  ADD CONSTRAINT wallet_funding_requests_wallet_id_fkey 
  FOREIGN KEY (wallet_id) 
  REFERENCES wallets(id) ON DELETE CASCADE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wallet_funding_requests_user_id 
  ON wallet_funding_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_funding_requests_wallet_id 
  ON wallet_funding_requests(wallet_id);
