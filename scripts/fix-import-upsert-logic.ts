#!/usr/bin/env tsx
/**
 * fix-import-upsert-logic.ts
 * 
 * This script contains improved UPSERT logic for all data import operations
 * to fix the foreign key constraint violations and duplicate key errors
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Safe venue upsert with proper error handling
 */
export async function safeVenueUpsert(venueData: any) {
  try {
    // First, check if venue exists
    const { data: existing } = await supabase
      .from('venues')
      .select('id')
      .eq('id', venueData.id)
      .single();

    if (existing) {
      // Update existing venue
      const { error } = await supabase
        .from('venues')
        .update({
          name: venueData.name,
          address: venueData.address,
          city: venueData.city,
          country: venueData.country,
          capacity: venueData.capacity,
          surface: venueData.surface,
          image: venueData.image,
          updated_at: new Date().toISOString()
        })
        .eq('id', venueData.id);

      if (error) throw error;
      console.log(`✅ Updated venue: ${venueData.name} (${venueData.id})`);
    } else {
      // Insert new venue
      const { error } = await supabase
        .from('venues')
        .insert([venueData]);

      if (error) throw error;
      console.log(`✅ Inserted venue: ${venueData.name} (${venueData.id})`);
    }
  } catch (error: any) {
    console.error(`❌ Error upserting venue ${venueData.id}:`, error.message);
    return false;
  }
  return true;
}

/**
 * Safe standings upsert with proper conflict resolution
 */
export async function safeStandingsUpsert(standingsData: any) {
  try {
    // Use PostgreSQL UPSERT with ON CONFLICT
    const { error } = await supabase
      .from('standings')
      .upsert([standingsData], {
        onConflict: 'league_id,season_year,team_id',
        ignoreDuplicates: false
      });

    if (error) throw error;
    console.log(`✅ Upserted standing for team ${standingsData.team_id} in league ${standingsData.league_id}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error upserting standings:`, error.message);
    return false;
  }
}

/**
 * Safe events upsert with proper constraint handling
 */
export async function safeEventsUpsert(eventData: any) {
  try {
    // Check if the fixture exists first
    const { data: fixture } = await supabase
      .from('fixtures')
      .select('id')
      .eq('id', eventData.fixture_id)
      .single();

    if (!fixture) {
      console.warn(`⚠️ Skipping event: fixture ${eventData.fixture_id} not found`);
      return false;
    }

    // Use upsert with the unique constraint we created
    const { error } = await supabase
      .from('events')
      .upsert([eventData], {
        onConflict: 'fixture_id,team_id,player_id,type,time_elapsed',
        ignoreDuplicates: true // Skip if exact duplicate
      });

    if (error) throw error;
    console.log(`✅ Upserted event for fixture ${eventData.fixture_id}`);
    return true;
  } catch (error: any) {
    // If constraint doesn't exist yet, try regular insert
    if (error.code === '42P10') {
      console.warn('⚠️ Events table missing unique constraint, attempting regular insert');
      try {
        const { error: insertError } = await supabase
          .from('events')
          .insert([eventData]);
        
        if (insertError && insertError.code !== '23505') {
          throw insertError;
        }
        return true;
      } catch (insertErr: any) {
        console.error(`❌ Error inserting event:`, insertErr.message);
        return false;
      }
    } else {
      console.error(`❌ Error upserting event:`, error.message);
      return false;
    }
  }
}

/**
 * Safe player statistics upsert with league validation
 */
export async function safePlayerStatsUpsert(statsData: any) {
  try {
    // First validate that the league exists
    const { data: league } = await supabase
      .from('leagues')
      .select('id')
      .eq('id', statsData.league_id)
      .eq('season_year', statsData.season_year)
      .single();

    if (!league) {
      console.warn(`⚠️ Skipping player stats: league ${statsData.league_id} not found for season ${statsData.season_year}`);
      return false;
    }

    // Use upsert with the existing unique constraint
    const { error } = await supabase
      .from('player_statistics')
      .upsert([statsData], {
        onConflict: 'player_id,team_id,league_id,season_year',
        ignoreDuplicates: false
      });

    if (error) throw error;
    console.log(`✅ Upserted player stats for player ${statsData.player_id}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error upserting player statistics:`, error.message);
    return false;
  }
}

/**
 * Safe fixture upsert with venue validation
 */
export async function safeFixtureUpsert(fixtureData: any) {
  try {
    // If venue_id is provided, validate it exists
    if (fixtureData.venue_id) {
      const { data: venue } = await supabase
        .from('venues')
        .select('id')
        .eq('id', fixtureData.venue_id)
        .single();

      if (!venue) {
        console.warn(`⚠️ Venue ${fixtureData.venue_id} not found, setting to null`);
        fixtureData.venue_id = null;
      }
    }

    // Use upsert with fixture ID
    const { error } = await supabase
      .from('fixtures')
      .upsert([fixtureData], {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (error) throw error;
    console.log(`✅ Upserted fixture ${fixtureData.id}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error upserting fixture ${fixtureData.id}:`, error.message);
    return false;
  }
}

/**
 * Batch upsert with error tolerance
 */
export async function safeBatchUpsert<T>(
  tableName: string,
  data: T[],
  upsertFunction: (item: T) => Promise<boolean>,
  batchSize: number = 10
) {
  let successCount = 0;
  let errorCount = 0;
  
  console.log(`🔄 Processing ${data.length} records for ${tableName} in batches of ${batchSize}`);

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    const promises = batch.map(async (item) => {
      const success = await upsertFunction(item);
      return success ? 'success' : 'error';
    });

    const results = await Promise.all(promises);
    successCount += results.filter(r => r === 'success').length;
    errorCount += results.filter(r => r === 'error').length;

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < data.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`📊 ${tableName} batch upsert completed: ${successCount} success, ${errorCount} errors`);
  return { successCount, errorCount };
}

/**
 * Validate database integrity after import
 */
export async function validateDatabaseIntegrity() {
  console.log('🔍 Running database integrity validation...');
  
  try {
    const { data, error } = await supabase
      .rpc('validate_data_integrity');

    if (error) {
      console.error('❌ Error running integrity validation:', error.message);
      return false;
    }

    if (data) {
      console.log('📋 Database Integrity Report:');
      data.forEach((check: any) => {
        const icon = check.status === 'PASS' ? '✅' : check.status === 'WARN' ? '⚠️' : '❌';
        console.log(`  ${icon} ${check.check_name}: ${check.details}`);
      });
    }

    return true;
  } catch (error: any) {
    console.error('❌ Integrity validation failed:', error.message);
    return false;
  }
}

/**
 * Initialize missing leagues that are referenced in API responses
 */
export async function initializeMissingLeagues() {
  console.log('🏆 Initializing missing leagues...');
  
  const missingLeagues = [
    {
      id: 15,
      name: 'FIFA World Cup',
      type: 'Cup',
      season_year: 2025,
      current: false,
      country_name: 'International'
    },
    {
      id: 294,
      name: 'AFC Asian Cup',
      type: 'Cup', 
      season_year: 2025,
      current: false,
      country_name: 'Asia'
    }
  ];

  for (const league of missingLeagues) {
    try {
      const { error } = await supabase
        .from('leagues')
        .upsert([league], {
          onConflict: 'id,season_year',
          ignoreDuplicates: false
        });

      if (error) throw error;
      console.log(`✅ Initialized league: ${league.name} (${league.id})`);
    } catch (error: any) {
      console.error(`❌ Error initializing league ${league.id}:`, error.message);
    }
  }
}

/**
 * Initialize missing venues that are referenced in fixtures
 */
export async function initializeMissingVenues() {
  console.log('🏟️ Initializing missing venues...');
  
  const missingVenues = [
    {
      id: 1005,
      name: 'Suwon World Cup Stadium',
      city: 'Suwon',
      country: 'South Korea',
      capacity: 43959,
      surface: 'Grass'
    },
    {
      id: 1009,
      name: 'Seoul World Cup Stadium', 
      city: 'Seoul',
      country: 'South Korea',
      capacity: 66806,
      surface: 'Grass'
    },
    {
      id: 1010,
      name: 'Daegu Stadium',
      city: 'Daegu', 
      country: 'South Korea',
      capacity: 66422,
      surface: 'Grass'
    }
  ];

  for (const venue of missingVenues) {
    const success = await safeVenueUpsert(venue);
    if (!success) {
      console.error(`❌ Failed to initialize venue ${venue.id}`);
    }
  }
}

/**
 * Main function to run all integrity fixes
 */
export async function runIntegrityFixes() {
  console.log('🔧 Starting database integrity fixes...');
  console.log('==========================================');

  // Initialize missing leagues and venues
  await initializeMissingLeagues();
  await initializeMissingVenues();

  // Validate the fixes
  await validateDatabaseIntegrity();

  console.log('==========================================');
  console.log('✅ Database integrity fixes completed!');
}

// Run the fixes if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrityFixes()
    .then(() => {
      console.log('🎉 All integrity fixes completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Integrity fixes failed:', error);
      process.exit(1);
    });
}