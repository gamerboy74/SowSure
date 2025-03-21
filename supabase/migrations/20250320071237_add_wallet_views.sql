-- Drop existing view if exists
DROP VIEW IF EXISTS public.wallet_funding_request_details;

-- Create enhanced view with all required user details
CREATE OR REPLACE VIEW public.wallet_funding_request_details AS
SELECT 
    wfr.*,
    au.email as user_email,
    au.raw_user_meta_data as user_metadata,
    w.wallet_address,
    w.token_balance,
    f.name as farmer_name,
    b.company_name as buyer_company_name
FROM 
    wallet_funding_requests wfr
    LEFT JOIN auth.users au ON wfr.user_id = au.id
    LEFT JOIN wallets w ON wfr.wallet_id = w.id
    LEFT JOIN farmers f ON wfr.user_id = f.user_id
    LEFT JOIN buyers b ON wfr.user_id = b.user_id;

-- Grant access to the view
GRANT SELECT ON wallet_funding_request_details TO anon, authenticated;
