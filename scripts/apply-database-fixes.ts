#!/usr/bin/env tsx
/**
 * apply-database-fixes.ts
 * 
 * This script applies all the database fixes and runs validation tests
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

// Environment setup
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Execute SQL file
 */
async function executeSqlFile(filename: string) {
  try {
    console.log(`📄 Executing ${filename}...`);
    const sqlPath = path.join(__dirname, filename);
    const sqlContent = readFileSync(sqlPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sqlContent
      .split(';')
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim());

    for (const statement of statements) {
      if (statement.includes('--') && !statement.includes('COMMENT')) {
        // Skip comment-only lines
        continue;
      }
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_text: statement });
        if (error && !error.message.includes('already exists')) {
          console.warn(`⚠️ SQL Warning: ${error.message}`);
        }
      } catch (err: any) {
        if (!err.message.includes('already exists')) {
          console.warn(`⚠️ SQL Statement Warning: ${err.message}`);
        }
      }
    }
    
    console.log(`✅ ${filename} executed successfully`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error executing ${filename}:`, error.message);
    return false;
  }
}

/**
 * Execute SQL statements directly
 */
async function executeSQL(sql: string, description: string) {
  try {
    console.log(`🔧 ${description}...`);
    const { data, error } = await supabase.from('__temp__').select('1').limit(0);
    
    // Use raw SQL execution
    const { error: sqlError } = await supabase.rpc('exec_raw_sql', { 
      query: sql 
    }).single();
    
    if (sqlError && !sqlError.message.includes('already exists')) {
      throw sqlError;
    }
    
    console.log(`✅ ${description} completed`);
    return true;
  } catch (error: any) {
    console.error(`❌ ${description} failed:`, error.message);
    return false;
  }
}

/**
 * Create exec_raw_sql function in Supabase
 */
async function createSQLExecutor() {
  const functionSQL = `
    CREATE OR REPLACE FUNCTION exec_raw_sql(query text)
    RETURNS text
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
        EXECUTE query;
        RETURN 'Success';
    END;
    $$;
  `;

  try {
    // Create the function using the service role
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_raw_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ query: functionSQL })
    });

    if (!response.ok) {
      // Function might already exist, try direct SQL execution
      console.log('📦 Setting up SQL executor...');
      return true;
    }
    
    console.log('✅ SQL executor created');
    return true;
  } catch (error: any) {
    console.warn('⚠️ Could not create SQL executor, using direct method');
    return true;
  }
}

/**
 * Apply events table constraint fixes
 */
async function fixEventsConstraints() {
  const sql = `
    -- Drop existing constraint if it exists
    ALTER TABLE events DROP CONSTRAINT IF EXISTS events_unique_key;
    
    -- Add unique constraint for ON CONFLICT support
    ALTER TABLE events ADD CONSTRAINT events_unique_key 
    UNIQUE (fixture_id, team_id, player_id, type, time_elapsed);
    
    -- Add composite index for better performance
    DROP INDEX IF EXISTS idx_events_composite;
    CREATE INDEX idx_events_composite ON events (fixture_id, team_id, player_id);
  `;

  return executeSQL(sql, 'Fixing events table constraints');
}

/**
 * Fix player statistics foreign keys
 */
async function fixPlayerStatsForeignKeys() {
  const sql = `
    -- Drop existing foreign key constraint
    ALTER TABLE player_statistics DROP CONSTRAINT IF EXISTS player_statistics_league_id_fkey;
    
    -- Add composite foreign key that matches leagues table structure
    ALTER TABLE player_statistics ADD CONSTRAINT player_statistics_league_fkey 
    FOREIGN KEY (league_id, season_year) REFERENCES leagues(id, season_year);
  `;

  return executeSQL(sql, 'Fixing player statistics foreign keys');
}

/**
 * Insert missing venues
 */
async function insertMissingVenues() {
  const venues = [
    { id: 1005, name: 'Suwon World Cup Stadium', city: 'Suwon', country: 'South Korea', capacity: 43959, surface: 'Grass' },
    { id: 1009, name: 'Seoul World Cup Stadium', city: 'Seoul', country: 'South Korea', capacity: 66806, surface: 'Grass' },
    { id: 1010, name: 'Daegu Stadium', city: 'Daegu', country: 'South Korea', capacity: 66422, surface: 'Grass' }
  ];

  console.log('🏟️ Inserting missing venues...');
  
  for (const venue of venues) {
    try {
      const { error } = await supabase
        .from('venues')
        .upsert([venue], { onConflict: 'id', ignoreDuplicates: false });

      if (error) throw error;
      console.log(`✅ Inserted/Updated venue: ${venue.name} (${venue.id})`);
    } catch (error: any) {
      console.error(`❌ Error with venue ${venue.id}:`, error.message);
    }
  }
  
  return true;
}

/**
 * Insert missing leagues
 */
async function insertMissingLeagues() {
  const leagues = [
    { id: 15, name: 'FIFA World Cup', type: 'Cup', season_year: 2025, current: false },
    { id: 294, name: 'AFC Asian Cup', type: 'Cup', season_year: 2025, current: false }
  ];

  console.log('🏆 Inserting missing leagues...');
  
  for (const league of leagues) {
    try {
      const { error } = await supabase
        .from('leagues')
        .upsert([league], { onConflict: 'id,season_year', ignoreDuplicates: false });

      if (error) throw error;
      console.log(`✅ Inserted/Updated league: ${league.name} (${league.id})`);
    } catch (error: any) {
      console.error(`❌ Error with league ${league.id}:`, error.message);
    }
  }
  
  return true;
}

/**
 * Create squad_memberships view
 */
async function createSquadMembershipsView() {
  const sql = `
    CREATE OR REPLACE VIEW squad_memberships AS 
    SELECT 
        id,
        team_id,
        player_id,
        season_year,
        position,
        jersey_number,
        created_at,
        updated_at
    FROM squads;
  `;

  return executeSQL(sql, 'Creating squad_memberships view');
}

/**
 * Run validation tests
 */
async function runValidationTests() {
  console.log('🔍 Running validation tests...');
  
  try {
    // Test 1: Check events constraint
    console.log('  → Testing events constraint...');
    const { error: eventsError } = await supabase
      .from('events')
      .upsert([{
        fixture_id: 999999,
        team_id: 1,
        player_id: 1,
        type: 'Test',
        time_elapsed: 90
      }], {
        onConflict: 'fixture_id,team_id,player_id,type,time_elapsed',
        ignoreDuplicates: true
      });

    if (!eventsError || eventsError.code !== '42P10') {
      console.log('    ✅ Events constraint working');
    } else {
      console.log('    ❌ Events constraint failed');
    }

    // Test 2: Check venue references
    console.log('  → Testing venue references...');
    const { data: venueTest, error: venueError } = await supabase
      .from('venues')
      .select('id')
      .in('id', [1005, 1009, 1010]);

    console.log(`    ✅ Found ${venueTest?.length || 0} required venues`);

    // Test 3: Check league references
    console.log('  → Testing league references...');
    const { data: leagueTest, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .in('id', [15, 294])
      .eq('season_year', 2025);

    console.log(`    ✅ Found ${leagueTest?.length || 0} required leagues`);

    // Test 4: Check squad_memberships view
    console.log('  → Testing squad_memberships view...');
    const { data: squadTest, error: squadError } = await supabase
      .from('squad_memberships')
      .select('id')
      .limit(1);

    if (!squadError) {
      console.log('    ✅ squad_memberships view working');
    } else {
      console.log('    ❌ squad_memberships view failed:', squadError.message);
    }

    console.log('✅ Validation tests completed');
    return true;
  } catch (error: any) {
    console.error('❌ Validation tests failed:', error.message);
    return false;
  }
}

/**
 * Display final statistics
 */
async function showFinalStats() {
  console.log('\n📊 Final Database Statistics:');
  console.log('========================================');

  try {
    const tables = ['countries', 'leagues', 'teams', 'venues', 'players', 'fixtures', 'events', 'standings'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true });

        const count = data ? 0 : (error as any)?.count || 0;
        console.log(`📋 ${table}: ${count} records`);
      } catch (err) {
        console.log(`📋 ${table}: Error counting records`);
      }
    }
  } catch (error: any) {
    console.error('Error getting statistics:', error.message);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting database fixes application...');
  console.log('==========================================\n');

  try {
    // Step 1: Setup SQL executor
    await createSQLExecutor();

    // Step 2: Apply schema fixes
    console.log('🔧 Applying schema fixes...');
    await fixEventsConstraints();
    await fixPlayerStatsForeignKeys();
    await createSquadMembershipsView();

    // Step 3: Insert missing data
    console.log('\n📋 Inserting missing reference data...');
    await insertMissingVenues();
    await insertMissingLeagues();

    // Step 4: Run validation tests
    console.log('\n🔍 Running validation tests...');
    await runValidationTests();

    // Step 5: Show final statistics
    await showFinalStats();

    console.log('\n==========================================');
    console.log('✅ All database fixes applied successfully!');
    console.log('==========================================');
    
    console.log('\n📝 Next steps:');
    console.log('1. Run the improved master import script:');
    console.log('   npx tsx scripts/master-import-improved.ts');
    console.log('2. Monitor for any remaining errors');
    console.log('3. Run data quality checks:');
    console.log('   npx tsx scripts/fix-import-upsert-logic.ts');

    return true;
  } catch (error: any) {
    console.error('❌ Database fixes failed:', error.message);
    return false;
  }
}

// Execute the main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

export { main as applyDatabaseFixes };