
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
const theSportsDBApiKey = process.env.THESPORTSDB_API_KEY || '460915';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addLaLiga() {
  console.log('🚀 Adding Spanish La Liga to leagues table...');

  // 1. Fetch League Details from TheSportsDB
  const leagueId = '4335'; // Spanish La Liga
  const url = `https://www.thesportsdb.com/api/v1/json/${theSportsDBApiKey}/lookupleague.php?id=${leagueId}`;
  
  try {
    const res = await fetch(url);
    const json = await res.json();
    const league = json.leagues ? json.leagues[0] : null;

    if (!league) {
      console.error('❌ Failed to fetch La Liga data from TheSportsDB');
      return;
    }

    console.log(`Fetched: ${league.strLeague}`);

    // 2. Prepare payload for DB
    const payload = {
      idLeague: league.idLeague,
      strLeague: league.strLeague,
      strLeagueAlternate: league.strLeagueAlternate,
      strSport: league.strSport,
      strCountry: league.strCountry,
      strCurrentSeason: league.strCurrentSeason,
      intFormedYear: league.intFormedYear,
      dateFirstEvent: league.dateFirstEvent,
      strGender: league.strGender,
      strWebsite: league.strWebsite,
      strDescriptionEN: league.strDescriptionEN,
      strBadge: league.strBadge,
      strLogo: league.strLogo,
      strBanner: league.strBanner,
      strTrophy: league.strTrophy,
      strPoster: league.strPoster,
      highlightly_id: 4335 // Placeholder ID
    };

    // 3. Upsert into leagues table
    const { data, error } = await supabase
      .from('leagues')
      .upsert(payload, { onConflict: 'idLeague' })
      .select();

    if (error) {
      console.error('❌ Error inserting La Liga:', error);
    } else {
      console.log('✅ Successfully added Spanish La Liga to DB!');
      console.table(data);
    }

  } catch (error) {
    console.error('❌ Script failed:', error);
  }
}

addLaLiga();
