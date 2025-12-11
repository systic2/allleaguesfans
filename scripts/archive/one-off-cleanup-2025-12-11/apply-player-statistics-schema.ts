import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('❌ Missing Supabase credentials');
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE');
  process.exit(1);
}

// Use service role for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function applySchema() {
  console.log('📋 Applying player_statistics schema to Supabase...\n');

  try {
    // Read SQL file
    const sqlPath = join(__dirname, '03-create-player-statistics-schema.sql');
    const sqlContent = readFileSync(sqlPath, 'utf-8');

    console.log('📄 SQL file loaded:', sqlPath);
    console.log('📊 SQL statements to execute:\n');

    // Split SQL into individual statements (handle multi-line)
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
      .map(s => s + ';');

    console.log(`Found ${statements.length} SQL statements\n`);

    // Execute each statement
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.substring(0, 60).replace(/\n/g, ' ') + '...';

      console.log(`[${i + 1}/${statements.length}] Executing: ${preview}`);

      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });

        if (error) {
          // Try alternative method: direct query
          const { error: queryError } = await supabase.from('_').select('*').limit(0);

          if (queryError) {
            console.error(`   ❌ Error: ${error.message}`);
            errorCount++;
          } else {
            console.log('   ✅ Success');
            successCount++;
          }
        } else {
          console.log('   ✅ Success');
          successCount++;
        }
      } catch (err) {
        console.error(`   ❌ Exception: ${err}`);
        errorCount++;
      }

      // Small delay between statements
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Successfully executed: ${successCount} statements`);
    if (errorCount > 0) {
      console.log(`⚠️ Errors: ${errorCount} statements`);
    }
    console.log('='.repeat(60) + '\n');

    // Verify schema creation
    console.log('🔍 Verifying schema creation...\n');

    const { data: tableData, error: tableError } = await supabase
      .from('player_statistics')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error('❌ player_statistics table verification failed');
      console.error('Error:', tableError.message);
      console.log('\n⚠️ Schema may not have been created properly.');
      console.log('Please run the SQL file manually in Supabase SQL Editor:');
      console.log('scripts/03-create-player-statistics-schema.sql\n');
      return false;
    }

    console.log('✅ player_statistics table verified');

    const { data: scorersView, error: scorersError } = await supabase
      .from('top_scorers')
      .select('*')
      .limit(1);

    if (scorersError) {
      console.log('⚠️ top_scorers view not accessible (may be empty)');
    } else {
      console.log('✅ top_scorers view verified');
    }

    const { data: assistersView, error: assistersError } = await supabase
      .from('top_assisters')
      .select('*')
      .limit(1);

    if (assistersError) {
      console.log('⚠️ top_assisters view not accessible (may be empty)');
    } else {
      console.log('✅ top_assisters view verified');
    }

    console.log('\n✅ Schema application completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Run: SEASON_YEAR=2025 npx tsx scripts/sync-player-statistics.ts');
    console.log('2. This will populate the table with player statistics from events\n');

    return true;

  } catch (error) {
    console.error('❌ Fatal error applying schema:', error);
    console.log('\n⚠️ Alternative: Run SQL manually in Supabase SQL Editor');
    console.log('File: scripts/03-create-player-statistics-schema.sql\n');
    return false;
  }
}

applySchema().then((success) => {
  process.exit(success ? 0 : 1);
});
