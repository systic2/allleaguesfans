
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
  const { error } = await supabase.from('players_v2').select('idPlayer').limit(1);
  if (error) {
    if (error.code === '42P01') { // undefined_table
      console.log('MISSING');
    } else {
      console.error('ERROR', error);
    }
  } else {
    console.log('EXISTS');
  }
}

checkTable();
