import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

console.log("SB URL", import.meta.env.VITE_SUPABASE_URL);

export const supabase = createClient(url, anonKey);
