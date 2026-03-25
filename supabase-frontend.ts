import { createClient } from '@supabase/supabase-js';

// Access through import.meta.env (Vite way)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isPlaceholder = !supabaseUrl || !supabaseAnonKey;

if (isPlaceholder) {
  console.error('❌ Supabase Frontend Error: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  console.log('Available env keys:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')));
}

// Ensure client doesn't throw on creation even if URLs are missing
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);
