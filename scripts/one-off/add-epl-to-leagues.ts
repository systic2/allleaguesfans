
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

async function addEPL() {
  console.log('🚀 Adding English Premier League to leagues table...');

  // 1. Fetch League Details from TheSportsDB
  const eplId = '4328';
  const url = `https://www.thesportsdb.com/api/v1/json/${theSportsDBApiKey}/lookupleague.php?id=${eplId}`;
  
  try {
    const res = await fetch(url);
    const json = await res.json();
    const league = json.leagues ? json.leagues[0] : null;

    if (!league) {
      console.error('❌ Failed to fetch EPL data from TheSportsDB');
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
      // Map other fields as needed, or keep it simple
      highlightly_id: 4328 // Using TSDB ID as placeholder for highlightly_id if unique constraint allows
    };

    // 3. Upsert into leagues table
    const { data, error } = await supabase
      .from('leagues')
      .upsert(payload, { onConflict: 'idLeague' })
      .select();

    if (error) {
      console.error('❌ Error inserting EPL:', error);
    } else {
      console.log('✅ Successfully added English Premier League to DB!');
      console.table(data);
    }

  } catch (error) {
    console.error('❌ Script failed:', error);
  }
}

addEPL();
