import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Frontend Supabase credentials missing — real-time features will not work');
}

// Frontend client using the public 'anon' key
export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);
