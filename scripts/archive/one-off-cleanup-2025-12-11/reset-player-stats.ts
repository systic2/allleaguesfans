
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY!
);

async function resetPlayerStats() {
  console.log('🗑️  Resetting player_statistics table...');

  const { error } = await supabase
    .from('player_statistics')
    .delete()
    .neq('id', -1); // Delete all rows

  if (error) {
    console.error('❌ Error resetting table:', error);
  } else {
    console.log('✅ player_statistics table cleared.');
  }
}

resetPlayerStats();
