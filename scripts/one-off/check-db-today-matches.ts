
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTodayMatches() {
  console.log('🔍 Checking DB for matches on 2025-12-13...');

  // Check specific date range for 2025-12-13
  const startOfDay = '2025-12-13T00:00:00Z';
  const endOfDay = '2025-12-13T23:59:59Z';

  const { data, error } = await supabase
    .from('events_v2')
    .select(
      `
      id, 
      date, 
      status, 
      leagueId,
      homeTeamId,
      awayTeamId,
      homeScore,
      awayScore
    `
    )
    .gte('date', startOfDay)
    .lte('date', endOfDay);

  if (error) {
    console.error('❌ DB Error:', error);
    return;
  }

  console.log(`✅ Found ${data?.length || 0} matches.`);
  
  if (data && data.length > 0) {
    data.forEach(m => {
      console.log(`- [${m.date}] ${m.status} | League: ${m.leagueId} | ${m.homeTeamId} vs ${m.awayTeamId} (${m.homeScore}-${m.awayScore})`);
    });
  } else {
    // If no matches found today, check surrounding days to see if dates are shifted
    console.log('\nChecking surrounding days (Dec 12 - Dec 14)...');
    const { data: nearData } = await supabase
      .from('events_v2')
      .select('id, date, status, leagueId')
      .gte('date', '2025-12-12T00:00:00Z')
      .lte('date', '2025-12-14T23:59:59Z')
      .limit(10);
      
    nearData?.forEach(m => {
      console.log(`- [${m.date}] ${m.status} | League: ${m.leagueId}`);
    });
  }
}

checkTodayMatches();
