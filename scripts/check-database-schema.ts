// scripts/check-database-schema.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseSchema() {
  console.log('🔍 Checking actual database schema...\n');

  // 1. Check standings table structure
  console.log('📊 STANDINGS TABLE:');
  const { data: standingsData, error: standingsError } = await supabase
    .from('standings')
    .select('*')
    .limit(1);

  if (standingsError) {
    console.log(`❌ Standings error: ${standingsError.message}`);
  } else if (standingsData && standingsData.length > 0) {
    console.log('✅ Standings columns:');
    Object.keys(standingsData[0]).forEach(col => console.log(`   - ${col}`));
  } else {
    console.log('⚠️ No standings data found');
  }

  // 2. Check fixtures table structure
  console.log('\n⚽ FIXTURES TABLE:');
  const { data: fixturesData, error: fixturesError } = await supabase
    .from('fixtures')
    .select('*')
    .limit(1);

  if (fixturesError) {
    console.log(`❌ Fixtures error: ${fixturesError.message}`);
  } else if (fixturesData && fixturesData.length > 0) {
    console.log('✅ Fixtures columns:');
    Object.keys(fixturesData[0]).forEach(col => console.log(`   - ${col}`));
  } else {
    console.log('⚠️ No fixtures data found');
  }

  // 3. Check leagues table
  console.log('\n🏆 LEAGUES TABLE:');
  const { data: leaguesData, error: leaguesError } = await supabase
    .from('leagues')
    .select('*')
    .limit(1);

  if (leaguesError) {
    console.log(`❌ Leagues error: ${leaguesError.message}`);
  } else if (leaguesData && leaguesData.length > 0) {
    console.log('✅ Leagues columns:');
    Object.keys(leaguesData[0]).forEach(col => console.log(`   - ${col}`));
  } else {
    console.log('⚠️ No leagues data found');
  }

  // 4. Check teams table
  console.log('\n🏃 TEAMS TABLE:');
  const { data: teamsData, error: teamsError } = await supabase
    .from('teams')
    .select('*')
    .limit(1);

  if (teamsError) {
    console.log(`❌ Teams error: ${teamsError.message}`);
  } else if (teamsData && teamsData.length > 0) {
    console.log('✅ Teams columns:');
    Object.keys(teamsData[0]).forEach(col => console.log(`   - ${col}`));
  } else {
    console.log('⚠️ No teams data found');
  }

  // 5. Check top_scorers table
  console.log('\n🥅 TOP_SCORERS TABLE:');
  const { data: scorersData, error: scorersError } = await supabase
    .from('top_scorers')
    .select('*')
    .limit(1);

  if (scorersError) {
    console.log(`❌ Top scorers error: ${scorersError.message}`);
  } else if (scorersData && scorersData.length > 0) {
    console.log('✅ Top scorers columns:');
    Object.keys(scorersData[0]).forEach(col => console.log(`   - ${col}`));
  } else {
    console.log('⚠️ No top scorers data found');
  }

  // 6. Check top_assists table
  console.log('\n🎯 TOP_ASSISTS TABLE:');
  const { data: assistsData, error: assistsError } = await supabase
    .from('top_assists')
    .select('*')
    .limit(1);

  if (assistsError) {
    console.log(`❌ Top assists error: ${assistsError.message}`);
  } else if (assistsData && assistsData.length > 0) {
    console.log('✅ Top assists columns:');
    Object.keys(assistsData[0]).forEach(col => console.log(`   - ${col}`));
  } else {
    console.log('⚠️ No top assists data found');
  }

  // 7. Check team_seasons table
  console.log('\n📅 TEAM_SEASONS TABLE:');
  const { data: teamSeasonsData, error: teamSeasonsError } = await supabase
    .from('team_seasons')
    .select('*')
    .limit(1);

  if (teamSeasonsError) {
    console.log(`❌ Team seasons error: ${teamSeasonsError.message}`);
  } else if (teamSeasonsData && teamSeasonsData.length > 0) {
    console.log('✅ Team seasons columns:');
    Object.keys(teamSeasonsData[0]).forEach(col => console.log(`   - ${col}`));
  } else {
    console.log('⚠️ No team seasons data found');
  }
}

checkDatabaseSchema().catch(console.error);