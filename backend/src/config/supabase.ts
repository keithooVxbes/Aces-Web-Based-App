import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Ensure env is loaded before reading variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  console.error('❌ SUPABASE_URL is missing from environment variables.');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY is missing. Backend will use ANON_KEY (RLS will apply).');
} else {
  console.log('✅ Supabase client initialized with SERVICE_ROLE_KEY (RLS bypassed).');
}

// Initialize the Supabase client with service_role key for backend admin operations
export const supabase = createClient(supabaseUrl, supabaseKey);
