import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Supabase credentials missing — doubt features will not work');
}

// Server-side client using service_role key (bypasses Row Level Security)
export const supabase = createClient(
  supabaseUrl || '',
  supabaseServiceKey || ''
);
