-- Create function to add funds to wallet
CREATE OR REPLACE FUNCTION add_wallet_funds(p_wallet_id UUID, p_amount DECIMAL)
RETURNS void AS $$
BEGIN
  -- Update wallet balance
  UPDATE wallets 
  SET token_balance = token_balance + p_amount,
      updated_at = NOW()
  WHERE id = p_wallet_id;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id,
    amount,
    type,
    status,
    metadata
  ) VALUES (
    p_wallet_id,
    p_amount,
    'DEPOSIT',
    'COMPLETED',
    jsonb_build_object('note', 'Funding Request Approved')
  );
END;
$$ LANGUAGE plpgsql;
