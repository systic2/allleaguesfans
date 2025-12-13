
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const theSportsDBApiKey = process.env.THESPORTSDB_API_KEY || '460915';

async function checkLaLiga() {
  const leagueId = '4335';
  const season = '2025-2026';
  const url = `https://www.thesportsdb.com/api/v1/json/${theSportsDBApiKey}/eventsseason.php?id=${leagueId}&s=${season}`;
  
  console.log(`🔍 Checking URL: ${url}`);

  try {
    const res = await fetch(url);
    const json = await res.json();
    
    if (!json.events) {
      console.log('❌ No events found in API response.');
      return;
    }

    console.log(`✅ Found ${json.events.length} events.`);
    
    // Check for matches around today (2025-12-13)
    const today = '2025-12-13';
    const todaysMatches = json.events.filter((e: any) => e.dateEvent === today);
    
    console.log(`
📅 Matches for ${today}:`);
    if (todaysMatches.length === 0) {
      console.log('None found.');
      
      // Find nearest matches
      const sorted = json.events.sort((a: any, b: any) => new Date(a.dateEvent).getTime() - new Date(b.dateEvent).getTime());
      const future = sorted.filter((e: any) => e.dateEvent >= today).slice(0, 3);
      const past = sorted.filter((e: any) => e.dateEvent < today).slice(-3);
      
      console.log('\nPrevious 3 matches:');
      past.forEach((e: any) => console.log(`- ${e.dateEvent}: ${e.strEvent} (${e.strStatus})`));
      
      console.log('\nNext 3 matches:');
      future.forEach((e: any) => console.log(`- ${e.dateEvent}: ${e.strEvent} (${e.strStatus})`));

    } else {
      todaysMatches.forEach((e: any) => console.log(`- ${e.strEvent} (${e.strStatus})`));
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkLaLiga();
