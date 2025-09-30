// Execute Drop All Tables - Safe Manual Approach
import 'dotenv/config';
import { supa } from './lib/supabase.js';

async function dropAllTables() {
  try {
    console.log('🗑️ Starting Safe Table Dropping...');
    
    // Tables to drop in correct order (respecting foreign keys)
    const tablesToDrop = [
      'players',    // depends on teams
      'events',     // depends on leagues  
      'standings',  // depends on leagues
      'teams',      // depends on leagues
      'leagues'     // no dependencies
    ];
    
    for (const tableName of tablesToDrop) {
      try {
        console.log(`\\n🗑️ Attempting to drop table: ${tableName}`);
        
        // Try to check if table exists first
        const { data: existing, error: checkError } = await supa
          .from(tableName)
          .select('count', { count: 'exact', head: true });
        
        if (checkError) {
          console.log(`⚠️ Table '${tableName}' may not exist: ${checkError.message}`);
          continue;
        }
        
        console.log(`✅ Table '${tableName}' exists, proceeding with manual instructions...`);
        
      } catch (error) {
        console.log(`⚠️ Could not check table '${tableName}':`, error);
      }
    }
    
    console.log(`\\n📋 MANUAL ACTIONS REQUIRED:`);
    console.log(`\\n🔗 Go to Supabase Dashboard → SQL Editor`);
    console.log(`\\n📝 Execute this SQL code:`);
    
    const dropSQL = `
-- Drop all tables in correct order
DROP TABLE IF EXISTS public.players CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;  
DROP TABLE IF EXISTS public.standings CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.leagues CASCADE;

-- Verify tables are dropped
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('leagues', 'teams', 'players', 'events', 'standings');
`;
    
    console.log(dropSQL);
    console.log(`\\n⚠️ After running the above SQL, run the table creation script.`);
    
  } catch (error) {
    console.error('❌ Drop operation failed:', error);
    throw error;
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  dropAllTables().catch(console.error);
}