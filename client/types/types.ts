export interface Farmer {
  id: string;
  user_id: string;
  name: string;
  phone_number: string;
  email: string;
  aadhar_number: string;
  pan_number: string;
  farmer_id?: string;
  profile_photo_url?: string;
  complete_address: string;
  pincode: string;
  land_type: string;
  land_size: number;
  land_number: string;
  nominee_name?: string;
  wallet_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface Buyer {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone_number: string;
  gstin: string;
  business_type: string;
  trade_license_url?: string;
  profile_photo_url?: string;
  purchase_capacity: number;
  storage_capacity: number;
  business_address: string;
  pincode: string;
  wallet_address: string | null;
  terms_accepted: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: {
    id: string;
    email: string;
  } | null;
  type: 'farmer' | 'buyer' | null;
}