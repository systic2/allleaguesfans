import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,          // https://xxxx.supabase.co
  import.meta.env.VITE_SUPABASE_ANON_KEY!,     // anon 키 (service role 아님)
  { auth: { persistSession: false } }
);
