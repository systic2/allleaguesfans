// scripts/check-actual-leagues.ts
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

async function checkActualLeagues() {
  console.log('🔍 Checking what leagues actually exist in database...\n');

  // 1. Check all leagues
  const { data: leagues } = await supabase
    .from('leagues')
    .select('*')
    .order('id');

  console.log(`📊 Total leagues found: ${leagues?.length || 0}`);
  leagues?.forEach(league => {
    console.log(`  - ID: ${league.id}, Name: "${league.name}", Country: ${league.country_code}, Season: ${league.season_year}`);
  });

  // 2. Check all teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, country_code')
    .limit(10);

  console.log(`\n🏆 Sample teams (first 10 of ${teams?.length || 0}):`);
  teams?.forEach(team => {
    console.log(`  - ID: ${team.id}, Name: "${team.name}", Country: ${team.country_code}`);
  });

  // 3. Check team_seasons
  const { data: teamSeasons } = await supabase
    .from('team_seasons')
    .select('league_id, season_year, teams!inner(name)')
    .limit(10);

  console.log(`\n⚽ Sample team seasons (first 10):`);
  teamSeasons?.forEach(ts => {
    console.log(`  - League: ${ts.league_id}, Season: ${ts.season_year}, Team: "${ts.teams.name}"`);
  });

  // 4. Check standings
  const { data: standings } = await supabase
    .from('standings')
    .select('league_id, season_year, teams!inner(name)')
    .limit(10);

  console.log(`\n📈 Sample standings (first 10):`);
  standings?.forEach(s => {
    console.log(`  - League: ${s.league_id}, Season: ${s.season_year}, Team: "${s.teams.name}"`);
  });

  // 5. Check what leagues have data
  const { data: leagueWithData } = await supabase
    .from('standings')
    .select('league_id')
    .eq('season_year', 2025);

  const uniqueLeagueIds = [...new Set(leagueWithData?.map(l => l.league_id) || [])];
  console.log(`\n🎯 Leagues with 2025 standings data: ${uniqueLeagueIds.join(', ')}`);

  // 6. Check if we have K League data with different IDs
  const { data: koreanTeams } = await supabase
    .from('teams')
    .select('id, name, country_code')
    .eq('country_code', 'KR');

  console.log(`\n🇰🇷 Korean teams found: ${koreanTeams?.length || 0}`);
  koreanTeams?.slice(0, 5).forEach(team => {
    console.log(`  - ID: ${team.id}, Name: "${team.name}"`);
  });
}

checkActualLeagues().catch(console.error);