-- Drop existing objects if they exist to avoid conflicts
DROP TRIGGER IF EXISTS wallet_transaction_trigger ON wallet_transactions;
DROP TRIGGER IF EXISTS user_wallet_trigger ON auth.users;
DROP FUNCTION IF EXISTS update_wallet_balance();
DROP FUNCTION IF EXISTS create_user_wallet();

-- Create wallets table with all required columns
CREATE TABLE IF NOT EXISTS wallets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    wallet_address TEXT,
    encrypted_private_key TEXT,
    encrypted_mnemonic TEXT,
    balance DECIMAL(20,8) DEFAULT 0 CHECK (balance >= 0),
    token_balance DECIMAL(20,8) DEFAULT 1000 CHECK (token_balance >= 0),
    network TEXT DEFAULT 'sepolia',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create wallet transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
    amount DECIMAL(20,8) NOT NULL,
    type TEXT CHECK (type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER')),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add the metadata column to wallet_transactions if it does not already exist
ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Create wallet funding requests table
CREATE TABLE IF NOT EXISTS wallet_funding_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
    amount_usdt DECIMAL(20,8) NOT NULL,
    amount_inr DECIMAL(20,8) NOT NULL,
    txid TEXT,
    payment_proof_url TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create function to update wallet balance
CREATE OR REPLACE FUNCTION update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'COMPLETED' THEN
        IF NEW.type = 'DEPOSIT' THEN
            UPDATE wallets 
            SET token_balance = token_balance + NEW.amount,
                updated_at = NOW()
            WHERE id = NEW.wallet_id;
        ELSIF NEW.type IN ('WITHDRAWAL', 'TRANSFER') THEN
            -- Check if sufficient balance exists
            IF (SELECT token_balance FROM wallets WHERE id = NEW.wallet_id) >= NEW.amount THEN
                UPDATE wallets 
                SET token_balance = token_balance - NEW.amount,
                    updated_at = NOW()
                WHERE id = NEW.wallet_id;
            ELSE
                RAISE EXCEPTION 'Insufficient balance for transaction';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Update transaction status to FAILED
        NEW.status := 'FAILED';
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update create_user_wallet function to create blockchain wallet
CREATE OR REPLACE FUNCTION create_user_wallet()
RETURNS TRIGGER AS $$
DECLARE 
    existing_wallet_count integer;
BEGIN
    -- Check if user already has a wallet
    SELECT COUNT(*) INTO existing_wallet_count
    FROM wallets 
    WHERE user_id = NEW.id;

    IF existing_wallet_count = 0 THEN
        -- Create new wallet only if user doesn't have one
        INSERT INTO wallets (
            user_id,
            token_balance,
            created_at,
            updated_at
        )
        VALUES (
            NEW.id,
            1000,  -- Initial token balance
            NOW(),
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint to ensure one wallet per user
ALTER TABLE wallets 
ADD CONSTRAINT one_wallet_per_user 
UNIQUE (user_id);

-- Create triggers
CREATE TRIGGER wallet_transaction_trigger
    AFTER UPDATE ON wallet_transactions
    FOR EACH ROW
    WHEN (OLD.status <> 'COMPLETED' AND NEW.status = 'COMPLETED')
    EXECUTE FUNCTION update_wallet_balance();

-- Create trigger for both INSERT and UPDATE on auth.users
DROP TRIGGER IF EXISTS user_wallet_trigger ON auth.users;
CREATE TRIGGER user_wallet_trigger
    AFTER INSERT OR UPDATE OF email ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_wallet();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_funding_requests_user_id ON wallet_funding_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_funding_requests_status ON wallet_funding_requests(status);
CREATE INDEX IF NOT EXISTS idx_wallet_funding_requests_created_at ON wallet_funding_requests(created_at DESC);
